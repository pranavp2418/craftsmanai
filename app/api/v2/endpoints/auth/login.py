from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit
from app.core.config import settings
from app.schemas.auth import LoginRequest, LoginResponse
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
    """
    
    # Check rate limit
    check_auth_rate_limit(request, "login")
    
    auth_service = AuthService(db)
    
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
    
    # Create tokens
    from app.core.security import create_access_token, create_refresh_token, decode_access_token, decode_refresh_token
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    refresh_token, token_id, expires_at = create_refresh_token(
        str(user.id), login_data.remember_me
    )
    
    # Get JTI from tokens for potential blacklisting
    access_payload = decode_access_token(access_token)
    refresh_payload = decode_refresh_token(refresh_token)
    
    # Store refresh token
    auth_service.token_repo.create_refresh_token(
        user_id=user.id,
        token=refresh_token,
        token_id=token_id,
        expires_at=expires_at
    )
    
    # Update last login
    auth_service.user_repo.update_last_login(user.id)
    
    # Set refresh token in HTTP-only cookie
    max_age = int(
        (7 * 24 * 60 * 60) if login_data.remember_me else (24 * 60 * 60)
    )
    
    is_dev = True  # TODO: Get from settings
    cookie_secure = not is_dev
    
    # response.set_cookie(
    #     key="refresh_token",
    #     value=refresh_token,
    #     max_age=max_age,
    #     httponly=True,
    #     secure=True,
    #     samesite="None",
    #     path="/"
    # )
    response.set_cookie(
    key="refresh_token",
    value=refresh_token,
    max_age=max_age,
    httponly=True,
    secure=True,      # IMPORTANT for HTTP
    samesite="Lax",    # or None only with HTTPS
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
