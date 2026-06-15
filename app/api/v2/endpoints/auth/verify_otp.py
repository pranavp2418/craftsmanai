from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from typing import Any
import secrets
import string

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit
from app.core.device_fingerprint import get_device_info_from_request
from app.schemas.auth import OTPVerifyRequest, LoginResponse, DeviceInfo
from app.services.auth import AuthService
from app.models.otp import OTP
from app.core.security import create_access_token, create_refresh_token
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/verify-otp", response_model=LoginResponse)
async def verify_otp(
    *,
    db: Session = Depends(get_db),
    otp_data: OTPVerifyRequest,
    otp_type: str = "email_verification",
    request: Request,
    response: Response
) -> Any:
    """
    Verify OTP and login user
    """
    
    # Check rate limit
    check_auth_rate_limit(request, "verify_otp")
    
    auth_service = AuthService(db)
    
    # Find valid OTP matching email, code, and otp_type in the query parameters
    otp = db.query(OTP).filter(
        OTP.email == otp_data.email,
        OTP.otp_code == otp_data.otp,
        OTP.otp_type == otp_type,
        OTP.is_used == False,
        OTP.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not otp:
        logger.warning(f"OTP verification failed for {otp_data.email} with type {otp_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
    
    # Get user
    user = auth_service.user_repo.get_user_by_email(otp_data.email)
    if not user:
        logger.warning(f"User not found for OTP verification: {otp_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
        
    if otp_type == "password_reset":
        # Generate random 10-character alphanumeric string
        random_str = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
        
        # Store in same otp_code field of the row
        otp.otp_code = random_str
        db.commit()
        
        logger.info(f"Password reset OTP verified, new verification code generated for {otp_data.email}")
        
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "access_token": random_str,
                "email": user.email
            }
        )
        
    # Mark OTP as used (for email_verification and other types)
    otp.is_used = True
    db.commit()
    
    # Mark email as verified
    if not user.is_verified:
        user.is_verified = True
        db.commit()
        
    # Create tokens and session
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
    access_token_exp = datetime.fromtimestamp(access_payload.get("exp"), tz=timezone.utc) if access_payload.get("exp") else None
    
    refresh_token, token_id, expires_at = create_refresh_token(str(user.id), False)
    
    # Handle device management - auto-detect from headers or use provided device_info
    device_id = None
    # Auto-detect device from request headers as primary source
    auto_device_info = get_device_info_from_request(request)
    
    if auto_device_info and auto_device_info.device_id:
        device_data = auto_device_info.model_dump(exclude_none=True)
        
        existing_device = auth_service.device_repo.get_device_by_device_id(
            user.id, auto_device_info.device_id
        )
        if existing_device:
            device_id = auto_device_info.device_id
            auth_service.device_repo.update_device_last_used(existing_device.id)
        else:
            active_devices = auth_service.device_repo.get_active_device_count(user.id)
            if active_devices >= settings.MAX_ACTIVE_DEVICES:
                auth_service.device_repo.revoke_old_devices(user.id, settings.MAX_ACTIVE_DEVICES - 1)
            auth_service.device_repo.create_device(user.id, device_data)
            device_id = auto_device_info.device_id
    elif otp_data.device_info and otp_data.device_info.device_id:
        # Fallback to provided device_info
        device_data = otp_data.device_info.model_dump(exclude_none=True)
        if not device_data.get("device_id"):
            import uuid
            device_data["device_id"] = str(uuid.uuid4())
        existing_device = auth_service.device_repo.get_device_by_device_id(
            user.id, device_data["device_id"]
        )
        if existing_device:
            device_id = device_data["device_id"]
            auth_service.device_repo.update_device_last_used(existing_device.id)
        else:
            active_devices = auth_service.device_repo.get_active_device_count(user.id)
            if active_devices >= settings.MAX_ACTIVE_DEVICES:
                auth_service.device_repo.revoke_old_devices(user.id, settings.MAX_ACTIVE_DEVICES - 1)
            auth_service.device_repo.create_device(user.id, device_data)
            device_id = device_data["device_id"]
            
    # Store refresh token with access token info
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
    
    # Set refresh token in HTTP-only cookie (same as login endpoint)
    cookie_days = settings.REFRESH_TOKEN_DAYS  # always use 7 days for OTP flows (no remember_me)
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
    
    logger.info(f"OTP verification successful for {otp_data.email} with type {otp_type}")
    
    # Send welcome email in background (non-blocking) if newly verified
    if otp_type == "email_verification":
        try:
            from app.tasks.email_tasks import send_welcome_email
            send_welcome_email.delay(
                to=user.email,
                user_name=user.username or user.email,
                dashboard_url="https://craftmenai.txogavideo.in/"
            )
            logger.info(f"Welcome email queued for {user.email}")
        except Exception as e:
            logger.warning(f"Failed to queue welcome email for {user.email}: {str(e)}")
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=str(user.id),
        email=user.email,
        username=user.username,
        is_superuser=user.is_superuser,
        is_verified=user.is_verified,
        notification_message="Welcome to craftsman.ai! Your account has been verified successfully.",
        profile_image_url=user.profile_image_url if hasattr(user, 'profile_image_url') else None,
        full_name=user.full_name if hasattr(user, 'full_name') else None
    )
