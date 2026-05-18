from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit
from app.schemas.auth import OTPVerifyRequest, LoginResponse
from app.services.auth import AuthService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/verify-otp", response_model=LoginResponse)
async def verify_otp(
    *,
    db: Session = Depends(get_db),
    otp_data: OTPVerifyRequest,
    request: Request
) -> Any:
    """
    Verify OTP and login user
    """
    
    # Check rate limit
    check_auth_rate_limit(request, "verify_otp")
    
    auth_service = AuthService(db)
    
    # Verify OTP and get user
    result = auth_service.verify_otp_and_login(
        otp_data.email, 
        otp_data.otp,
        otp_data.device_info
    )
    
    if not result["success"]:
        logger.warning(f"OTP verification failed for {otp_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"]
        )
    
    logger.info(f"OTP verification successful for {otp_data.email}")
    
    # Send welcome email in background (non-blocking) if newly verified
    try:
        from app.tasks.email_tasks import send_welcome_email
        send_welcome_email.delay(
            to=result["email"],
            user_name=result["username"] or result["email"]
        )
        logger.info(f"Welcome email queued for {result['email']}")
    except Exception as e:
        logger.warning(f"Failed to queue welcome email for {result['email']}: {str(e)}")
    
    return LoginResponse(
        access_token=result["access_token"],
        token_type=result.get("token_type", "bearer"),
        expires_in=result["expires_in"],
        user_id=result["user_id"],
        email=result["email"],
        username=result["username"],
        is_superuser=result["is_superuser"],
        is_verified=result["is_verified"],
        notification_message=result.get("notification_message"),
        profile_image_url=result.get("profile_image_url")
    )
