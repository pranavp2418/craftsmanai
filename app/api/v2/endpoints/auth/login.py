from datetime import datetime
from app.core.timezone import now as tz_now, CST_TZ
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit, rate_limiter, get_rate_limit_key
from app.core.token_blacklist import token_blacklist
from app.models.blacklisted_token import BlacklistedToken
from app.core.config import settings
from app.core.device_fingerprint import get_device_info_from_request
from app.schemas.auth import LoginRequest, LoginResponse, DeviceInfo
from app.services.auth import AuthService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _blacklist_token_in_db(db: Session, jti: str, token_type: str, expires_at: datetime, reason: str = "device_limit_exceeded", user_id: str = None):
    """Insert a blacklisted token record into the database for persistence and audit trail"""
    try:
        existing = db.query(BlacklistedToken).filter(BlacklistedToken.jti == jti).first()
        if existing:
            return True
            
        blacklisted = BlacklistedToken(
            jti=jti,
            token_type=token_type,
            user_id=int(user_id) if user_id else None,
            reason=reason,
            expires_at=expires_at
        )
        db.add(blacklisted)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to blacklist token {jti} in DB: {str(e)}")
        return False


@router.post("/login", response_model=LoginResponse)
async def login(
    *,
    db: Session = Depends(get_db),
    login_data: LoginRequest,
    request: Request,
    response: Response
) -> Any:
    """
    Login for already verified users (bypass OTP)
    Handles device detection and max device limit enforcement.
    """
    
    # Note: Removed check_auth_rate_limit here because it bypasses in development mode
    # The login lockout check below handles rate limiting per email
    
    auth_service = AuthService(db)
    
    # Auto-detect device info from request headers
    device_info = get_device_info_from_request(request)
    
    # Check if account is locked (BEFORE authentication - blocks even correct password)
    failed_key = get_rate_limit_key(request, f"login_failed:{login_data.email}")
    logger.info(f"LOCKOUT_DEBUG: Checking lockout for key: {failed_key}, email: {login_data.email}")
    
    # Check if account is locked (without incrementing counter)
    is_rate_limited = rate_limiter.is_rate_limited(
        failed_key, 
        f"{settings.MAX_FAILED_LOGIN_ATTEMPTS}/{settings.ACCOUNT_LOCKOUT_MINUTES} minutes",
        bypass_mode_check=True
    )
    
    logger.info(f"LOCKOUT_DEBUG: is_rate_limited={is_rate_limited}")
    
    if is_rate_limited:
        # Account is locked due to too many failed attempts
        logger.warning(f"Login attempt for locked account: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is temporarily locked due to multiple failed login attempts. Please try again in {settings.ACCOUNT_LOCKOUT_MINUTES} minutes.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Authenticate user
    user = auth_service.user_repo.authenticate_user(login_data.email, login_data.password)
    
    if not user:
        # Increment failed attempt counter (use is_allowed directly to bypass dev mode check)
        is_allowed, limit_info = rate_limiter.is_allowed(
            failed_key, 
            str(settings.MAX_FAILED_LOGIN_ATTEMPTS), 
            settings.ACCOUNT_LOCKOUT_MINUTES * 60,
            bypass_mode_check=True
        )
        
        logger.info(f"LOCKOUT_DEBUG: Failed login #{settings.MAX_FAILED_LOGIN_ATTEMPTS - int(limit_info.get('remaining', 0))}, is_allowed={is_allowed}, remaining={limit_info.get('remaining', 0)}")
        logger.warning(f"Login failed for email: {login_data.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        logger.warning(f"Login attempt for inactive user: {user.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_verified:
        logger.warning(f"Login attempt for unverified user: {user.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not verified. Please verify your email address.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Check if 2FA is enabled
    if user.is_2fa_enabled:
        logger.info(f"2FA verification required for user: {user.email}")
        from app.services.otp_service import generate_and_send_otp

        generate_and_send_otp(
            db=db,
            user=user,
            otp_type="login_2fa"
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "TWO_FACTOR_REQUIRED",
                "message": "OTP verification required"
            },
        )

    
    # Handle device management (max device limit)
    device_id = None
    if device_info and device_info.device_id:
        device_data = device_info.model_dump(exclude_none=True)
        logger.info(f"DEVICE_DEBUG: device_id={device_info.device_id}, device_type={device_info.device_type}, browser={device_info.browser}")
        
        # Check if device already exists AND is still active
        existing_device = auth_service.device_repo.get_device_by_device_id(
            user.id, device_info.device_id
        )
        
        # Only treat as existing if the device is active (not revoked)
        if existing_device and existing_device.is_active:
            device_id = device_info.device_id
            logger.info(f"DEVICE_DEBUG: Existing ACTIVE device found {existing_device.id}, updating last_used")
            auth_service.device_repo.update_device_last_used(existing_device.id)
        else:
            # Check if user exceeds max devices
            active_devices = auth_service.device_repo.get_active_device_count(user.id)
            logger.info(f"DEVICE_DEBUG: New device login. Active device count={active_devices}, MAX_ACTIVE_DEVICES={settings.MAX_ACTIVE_DEVICES}")
            if active_devices >= settings.MAX_ACTIVE_DEVICES:
                logger.info("DEVICE_DEBUG: Limit exceeded! Proceeding to revoke oldest devices...")
                from app.models.refresh_token import RefreshToken
                
                # Get all active devices sorted by last_used (oldest first)
                all_active_devices = auth_service.device_repo.get_user_devices(user.id, active_only=True)
                all_active_devices.sort(key=lambda x: x.last_used or datetime.min.replace(tzinfo=CST_TZ))
                
                # Determine how many to revoke (we keep MAX_ACTIVE_DEVICES - 1, 1 slot goes to new device)
                keep_count = max(settings.MAX_ACTIVE_DEVICES - 1, 0)
                devices_to_revoke = all_active_devices[:-keep_count] if keep_count > 0 else all_active_devices
                
                # Blacklist all tokens and revoke devices that exceed the limit
                now = tz_now()
                for device in devices_to_revoke:
                    if device.device_id:
                        # Get all active refresh tokens for this device
                        device_tokens = db.query(RefreshToken).filter(
                            RefreshToken.user_id == user.id,
                            RefreshToken.device_id == device.device_id,
                            RefreshToken.is_active == True
                        ).all()
                        
                        for token_record in device_tokens:
                            # Blacklist associated access token in Redis and DB
                            if token_record.access_token_jti and token_record.access_token_expires_at:
                                remaining_seconds = max(int((token_record.access_token_expires_at - now).total_seconds()), 0)
                                remaining_minutes = max(remaining_seconds // 60, 1)
                                token_blacklist.blacklist_access_token(token_record.access_token_jti, remaining_minutes)
                                # Also persist in DB for audit trail
                                _blacklist_token_in_db(
                                    db, token_record.access_token_jti, "access",
                                    token_record.access_token_expires_at, "device_limit_exceeded", str(user.id)
                                )
                                
                            # Blacklist refresh token in Redis and DB
                            if token_record.expires_at:
                                token_blacklist.blacklist_refresh_token(token_record.token_id, token_record.expires_at)
                                # Also persist in DB for audit trail
                                _blacklist_token_in_db(
                                    db, token_record.token_id, "refresh",
                                    token_record.expires_at, "device_limit_exceeded", str(user.id)
                                )
                        
                        # Revoke all refresh tokens for this device in DB
                        auth_service.token_repo.revoke_device_tokens(user.id, device.device_id)
                        
                        # Deactivate the device record
                        device.is_active = False
                        logger.info(f"Revoked device {device.device_id} for user: {user.email}, tokens blacklisted")
                
                db.commit()
            
            # Create the new device
            new_device = auth_service.device_repo.create_device(user.id, device_data)
            device_id = device_info.device_id
    
    # Create tokens
    from app.core.security import create_access_token, create_refresh_token
    from jose import jwt
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    
    # Extract access token JTI and expiry for storage
    access_payload = jwt.decode(
        access_token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"verify_exp": False}
    )
    access_token_jti = access_payload.get("jti")
    access_token_exp = datetime.fromtimestamp(access_payload.get("exp"), tz=CST_TZ) if access_payload.get("exp") else None
    
    refresh_token, token_id, expires_at = create_refresh_token(
        str(user.id), login_data.remember_me
    )
    
    # Store refresh token with device_id and access token info
    auth_service.token_repo.create_refresh_token(
        user_id=user.id,
        token=refresh_token,
        token_id=token_id,
        expires_at=expires_at,
        device_id=device_id,
        access_token_jti=access_token_jti,
        access_token_expires_at=access_token_exp
    )
    
    # Update last login
    auth_service.user_repo.update_last_login(user.id)
    
    # Set refresh token in HTTP-only cookie
    # Max age must match the token's actual expiration from create_refresh_token
    cookie_days = (
        settings.REFRESH_TOKEN_DAYS_REMEMBER
        if login_data.remember_me
        else settings.REFRESH_TOKEN_DAYS
    )
    max_age = int(cookie_days * 24 * 60 * 60)
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        secure=True,
        samesite="Lax",
        path="/"
    )
    logger.info(f"User logged in: {user.email}")
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=str(user.id),
        email=user.email,
        username=user.username,
        is_superuser=user.is_superuser,
        is_verified=user.is_verified,
        notification_message="Welcome back!",
        profile_image_url=None,
        full_name=user.full_name if user.full_name else None


    )