import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_register_rate_limit
from app.repositories.user import UserRepository
from app.schemas.auth import SignupRequest, SignUpResponse
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

router = APIRouter()


def _generate_unique_username(user_repo: UserRepository, email: str) -> str:
    base_username = re.sub(r"[^a-z0-9._-]", "", email.split("@")[0].lower()).strip("._-")
    if not base_username:
        base_username = "user"

    max_length = 100
    username = base_username[:max_length]
    suffix = 1

    while user_repo.username_exists(username):
        suffix_str = str(suffix)
        trimmed_base = base_username[: max_length - len(suffix_str)]
        username = f"{trimmed_base}{suffix_str}"
        suffix += 1

    return username


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
    
    # Single-query check: email + whatsapp uniqueness in one round-trip
    existing = user_repo.check_existing_identities(
        user_in.email, user_in.whatsapp_number
    )

    if existing.get("email"):
        existing_user = user_repo.get_user_by_email(user_in.email)
        if existing_user and existing_user.is_verified:
            logger.warning(f"Duplicate signup attempt for existing verified email: {user_in.email}")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered"
            )
        # User exists but is not verified — resend OTP
        user = existing_user
        logger.info(f"Resending OTP for unverified user: {user.email}")
    elif existing.get("whatsapp"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="WhatsApp number already registered"
        )
    else:
        # Create new user with all fields in one call
        username = _generate_unique_username(user_repo, user_in.email)
        user = user_repo.create_user(
            email=user_in.email,
            username=username,
            business_name=user_in.business_name,
            full_name=None,
            password=user_in.password,
            whatsapp_number=user_in.whatsapp_number,
        )
    
    # Generate OTP
    # from app.services.auth import AuthService
    # auth_service = AuthService(db)
    # otp_code = auth_service.generate_and_save_otp(
    #     user.email, "email_verification", user.id
    # )
    
    # logger.info(f"OTP generated and sent to {user.email}")
    
    # # Send OTP email (background task)
    # from app.tasks.email_tasks import send_signup_otp_email
    # send_signup_otp_email.delay(
    #     to=user.email,
    #     otp=otp_code,
    #     user_name=user.full_name or user.email
    # )

    from app.services.otp_service import generate_and_send_otp

    generate_and_send_otp(
        db=db,
        user=user,
        otp_type="email_verification"
    )
    
    logger.info(f"User signup/retry: {user.email} (ID: {user.id})")
    
    return SignUpResponse(
        success=True,
        message="A verification code has been sent to your email."
    )
