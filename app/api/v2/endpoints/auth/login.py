from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit
from app.core.config import settings
from app.core.device_fingerprint import get_device_info_from_request
from app.schemas.auth import LoginRequest, LoginResponse, DeviceInfo
from app.services.auth import AuthService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


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
    
    # Check rate limit
    check_auth_rate_limit(request, "login")
    
    auth_service = AuthService(db)
    
    # Auto-detect device info from request headers
    device_info = get_device_info_from_request(request)
    
    # Authenticate user
    user = auth_service.user_repo.authenticate_user(login_data.email, login_data.password)
    
    if not user:
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
    
    # Handle device management (max device limit)
    device_id = None
    if device_info and device_info.device_id:
        device_data = device_info.model_dump(exclude_none=True)
        
        # Check if device already exists
        existing_device = auth_service.device_repo.get_device_by_device_id(
            user.id, device_info.device_id
        )
        
        if existing_device:
            device_id = device_info.device_id
            auth_service.device_repo.update_device_last_used(existing_device.id)
        else:
            # Check if user exceeds max devices
            active_devices = auth_service.device_repo.get_active_device_count(user.id)
            if active_devices >= settings.MAX_ACTIVE_DEVICES:
                # Revoke oldest device
                revoked = auth_service.device_repo.revoke_old_devices(user.id, settings.MAX_ACTIVE_DEVICES - 1)
                logger.info(f"Revoked {revoked} old devices for user: {user.email}")
            
            new_device = auth_service.device_repo.create_device(user.id, device_data)
            device_id = device_info.device_id
    
    # Create tokens
    from app.core.security import create_access_token, create_refresh_token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    refresh_token, token_id, expires_at = create_refresh_token(
        str(user.id), login_data.remember_me
    )
    
    # Store refresh token with device_id
    auth_service.token_repo.create_refresh_token(
        user_id=user.id,
        token=refresh_token,
        token_id=token_id,
        expires_at=expires_at,
        device_id=device_id
    )
    
    # Update last login
    auth_service.user_repo.update_last_login(user.id)
    
    # Set refresh token in HTTP-only cookie
    max_age = int(
        (7 * 24 * 60 * 60) if login_data.remember_me else (24 * 60 * 60)
    )
    
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
        profile_image_url=None
    )