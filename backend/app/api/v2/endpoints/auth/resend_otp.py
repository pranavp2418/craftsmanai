from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit
from app.schemas.auth import ResendOTPRequest, SignUpResponse
from app.services.auth import AuthService
from app.services.email_service import EmailService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/resend-otp", response_model=SignUpResponse)
async def resend_otp(
    *,
    db: Session = Depends(get_db),
    otp_request: ResendOTPRequest,
    background_tasks: BackgroundTasks,
    request: Request
) -> Any:
    """
    Resend OTP for email verification
    """
    
    # Check rate limit
    check_auth_rate_limit(request, "resend_otp")
    
    auth_service = AuthService(db)
    
    # Check if user exists
    user = auth_service.user_repo.get_user_by_email(otp_request.email)
    
    if not user:
        # Return generic message to prevent email enumeration
        return SignUpResponse(
            success=True,
            message="If this email is registered, you will receive a verification code."
        )
    
    if user.is_verified:
        return SignUpResponse(
            success=True,
            message="Email is already verified."
        )
    
    # Generate new OTP
    otp_code = auth_service.generate_and_save_otp(
        user.email, "email_verification", user.id
    )
    
    logger.info(f"Resent OTP for user {user.email}: code={otp_code}")
    
    # Send OTP email (background task)
    from app.tasks.email_tasks import send_signup_otp_email
    send_signup_otp_email.delay(
        to=user.email,
        otp=otp_code,
        user_name=user.full_name or user.email
    )
    
    logger.info(f"OTP resent for user: {user.email}")
    
    return SignUpResponse(
        success=True,
        message="Verification code sent to your email."
    )
