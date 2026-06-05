from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_password_reset_rate_limit
from app.schemas.auth import PasswordResetRequest, SignUpResponse
from app.services.auth import AuthService
from app.services.email_service import EmailService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/password-reset", response_model=SignUpResponse)
async def request_password_reset(
    *,
    db: Session = Depends(get_db),
    reset_request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    request: Request
) -> Any:
    """
    Request password reset with OTP
    """
    
    # Check rate limit
    check_password_reset_rate_limit(request)
    
    auth_service = AuthService(db)
    
    # Check if user exists
    user = auth_service.user_repo.get_user_by_email(reset_request.email)
    
    if not user:
        # Return generic message to prevent email enumeration
        return SignUpResponse(
            success=True,
            message="If this email is registered, you will receive a password reset code."
        )
    
    # Generate OTP for password reset
    otp_code = auth_service.generate_and_save_otp(
        user.email, "password_reset", user.id
    )
    
    logger.info(f"Generated password reset OTP for user {user.email}: code={otp_code}")
    
    # Send OTP email (background task)
    from app.tasks.email_tasks import send_password_reset_email
    send_password_reset_email.delay(
        to=user.email,
        otp=otp_code,
        user_name=user.full_name or user.email
    )
    
    logger.info(f"Password reset OTP sent for user: {user.email}")
    
    return SignUpResponse(
        success=True,
        message="Password reset code sent to your email."
    )


@router.post("/resend-password-reset-otp", response_model=SignUpResponse)
async def resend_password_reset_otp(
    *,
    db: Session = Depends(get_db),
    reset_request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    request: Request
) -> Any:
    """
    Resend password reset OTP
    """
    
    # Check rate limit
    check_password_reset_rate_limit(request)
    
    auth_service = AuthService(db)
    
    # Check if user exists
    user = auth_service.user_repo.get_user_by_email(reset_request.email)
    
    if not user:
        # Return generic message to prevent email enumeration
        return SignUpResponse(
            success=True,
            message="If this email is registered, you will receive a password reset code."
        )
    
    # Generate new OTP for password reset
    otp_code = auth_service.generate_and_save_otp(
        user.email, "password_reset", user.id
    )
    
    logger.info(f"Resent password reset OTP for user {user.email}: code={otp_code}")
    
    # Send OTP email (background task)
    from app.tasks.email_tasks import send_password_reset_email
    send_password_reset_email.delay(
        to=user.email,
        otp=otp_code,
        user_name=user.full_name or user.email
    )
    
    logger.info(f"Password reset OTP resent for user: {user.email}")
    
    return SignUpResponse(
        success=True,
        message="Password reset code sent to your email."
    )
