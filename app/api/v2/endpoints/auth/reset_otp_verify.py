from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Any
from app.core.timezone import now as tz_now
 
from app.core.database import get_db
from app.core.rate_limiter import check_password_reset_rate_limit
from app.schemas.auth import PasswordResetConfirm, MessageResponse
from app.services.auth import AuthService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/verify-password-reset", response_model=MessageResponse)
async def reset_password_with_otp(
    *,
    db: Session = Depends(get_db),
    reset_data: PasswordResetConfirm,
    request: Request
) -> Any:
    """
    Reset password using OTP verification
    """
    
    # Check rate limit
    check_password_reset_rate_limit(request)
    
    auth_service = AuthService(db)
    
    # Verify OTP for password reset
    from app.models.otp import OTP
    otp = db.query(OTP).filter(
        OTP.email == reset_data.email,
        OTP.otp_code == reset_data.token,
        OTP.otp_type == "password_reset",
        OTP.is_used == False,
        OTP.expires_at > tz_now()
    ).first()
    
    if not otp:
        logger.warning("Invalid or expired password reset OTP")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code"
        )
    
    # Get user
    user = auth_service.user_repo.get_user_by_email(otp.email)
    if not user:
        logger.warning(f"Password reset for non-existent user: {otp.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    # Mark OTP as used
    otp.is_used = True
    db.commit()
    
    # Update password
    from app.core.security import get_password_hash
    user.hashed_password = get_password_hash(reset_data.new_password)
    db.commit()
    
    # Revoke all tokens for security
    revoked_count = auth_service.token_repo.revoke_all_user_tokens(user.id)
    
    logger.info(f"Password reset completed for user: {user.email}, revoked {revoked_count} tokens")
    
    return MessageResponse(message="Password reset successfully")
