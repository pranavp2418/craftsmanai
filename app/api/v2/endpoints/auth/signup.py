from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_register_rate_limit
from app.repositories.user import UserRepository
from app.schemas.auth import SignupRequest, SignUpResponse
from app.services.email_service import EmailService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/signup", response_model=SignUpResponse, status_code=201)
async def signup(
    *,
    db: Session = Depends(get_db),
    user_in: SignupRequest,
    background_tasks: BackgroundTasks,
    request: Request
) -> Any:
    """
    User registration with OTP verification
    """
    
    # Check rate limit
    check_register_rate_limit(request)
    
    user_repo = UserRepository(db)
    
    # Check if user already exists
    existing_user = user_repo.get_user_by_email(user_in.email)
    
    if existing_user:
        # Always return generic message to prevent email enumeration
        # This is idempotent behavior - same response whether new or existing user
        user = existing_user
    else:
        # Create new user
        user = user_repo.create_user(
            email=user_in.email,
            username=user_in.email.split('@')[0],  # Use email prefix as username
            full_name=None,
            password=user_in.password
        )
        # Update WhatsApp number
        user_repo.update_user(user.id, whatsapp_number=user_in.whatsapp_number)
    
    # Generate OTP for both new and existing users
    from app.services.auth import AuthService
    auth_service = AuthService(db)
    otp_code = auth_service.generate_and_save_otp(
        user.email, "email_verification", user.id
    )
    
    # Log OTP for debugging (only in development)
    import os
    if os.environ.get("ENV") == "development" or os.environ.get("DEBUG") == "true":
        print(f"🔐 DEBUG OTP for {user.email}: {otp_code}")
    
    logger.info(f"Generated OTP for user {user.email}: code={otp_code}")
    logger.warning(f"OTP_DEBUG: User {user.email} received OTP: {otp_code}")  # More visible in logs
    
    # Send OTP email (background task)
    from app.tasks.email_tasks import send_signup_otp_email
    send_signup_otp_email.delay(
        to=user.email,
        otp=otp_code,
        user_name=user.full_name or user.email
    )
    
    logger.info(f"User signup: {user.email} (ID: {user.id})")
    
    return SignUpResponse(
        success=True,
        message="If this email is registered, you will receive a verification code."
    )
