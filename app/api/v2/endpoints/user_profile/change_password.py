from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.user_profile import ChangePasswordRequest
from app.models.user import User
from app.models.blacklisted_token import BlacklistedToken
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.core.token_blacklist import token_blacklist
from app.core.config import settings
from app.repositories.user import RefreshTokenRepository
from app.core.rate_limiter import rate_limiter, get_rate_limit_key
from jose import jwt
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    *,
    db: Session = Depends(get_db),
    request: Request,
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    response: Response
):
    """
    Change the current user's password.
    
    On successful password change:
    - All existing refresh tokens and access tokens are blacklisted (logout from all devices)
    - A new access token and refresh token are issued
    - The refresh token is set as an HTTP-only cookie
    - The new access token is returned in the response body
    """
    # Check if password change is locked due to too many failed attempts
    password_change_key = get_rate_limit_key(request, f"password_change:{current_user.id}")
    
    is_rate_limited = rate_limiter.is_rate_limited(
        password_change_key,
        f"5/{settings.ACCOUNT_LOCKOUT_MINUTES} minutes",
        bypass_mode_check=True
    )
    
    if is_rate_limited:
        logger.warning(f"Password change attempt for locked user: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Too many failed password change attempts. Please try again in {settings.ACCOUNT_LOCKOUT_MINUTES} minutes.",
        )
    
    if password_data.new_password != password_data.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match"
        )

    if not verify_password(password_data.current_password, current_user.hashed_password):
        # Increment failed attempt counter
        rate_limiter.is_allowed(
            password_change_key,
            "5",
            settings.ACCOUNT_LOCKOUT_MINUTES * 60,
            bypass_mode_check=True
        )
        
        logger.warning(f"Password change failed - incorrect current password for user: {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    # Update the password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    # --- Blacklist all existing tokens (logout from all devices) ---
    token_repo = RefreshTokenRepository(db)
    
    # Get all active refresh tokens for this user
    from app.models.refresh_token import RefreshToken
    active_refresh_tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.is_active == True
    ).all()

    now = datetime.now(timezone.utc)

    for token_record in active_refresh_tokens:
        # 1. Blacklist the associated access token in Redis and DB
        if token_record.access_token_jti and token_record.access_token_expires_at:
            remaining_seconds = max(int((token_record.access_token_expires_at - now).total_seconds()), 0)
            remaining_minutes = max(remaining_seconds // 60, 1)
            
            # Blacklist in Redis
            token_blacklist.blacklist_access_token(token_record.access_token_jti, remaining_minutes)
            
            # Blacklist in DB for audit trail
            _blacklist_token_in_db(
                db,
                token_record.access_token_jti,
                "access",
                token_record.access_token_expires_at,
                "password_change",
                str(current_user.id)
            )
            logger.info(f"Blacklisted access token JTI: {token_record.access_token_jti} during password change")

        # 2. Blacklist the refresh token in Redis
        if token_record.expires_at:
            token_blacklist.blacklist_refresh_token(token_record.token_id, token_record.expires_at)
            
            # Blacklist in DB for audit trail
            _blacklist_token_in_db(
                db,
                token_record.token_id,
                "refresh",
                token_record.expires_at,
                "password_change",
                str(current_user.id)
            )
            logger.info(f"Blacklisted refresh token JTI: {token_record.token_id} during password change")

    # 3. Revoke all refresh tokens in the database
    token_repo.revoke_all_user_tokens(current_user.id)

    # --- Issue new tokens ---
    # Create new access token
    access_token = create_access_token(data={"sub": str(current_user.id), "email": current_user.email})
    
    # Extract access token JTI and expiry for storage
    access_payload = jwt.decode(
        access_token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"verify_exp": False}
    )
    access_token_jti = access_payload.get("jti")
    access_token_exp = datetime.fromtimestamp(access_payload.get("exp"), tz=timezone.utc) if access_payload.get("exp") else None

    # Create new refresh token
    refresh_token, token_id, expires_at = create_refresh_token(
        str(current_user.id), remember_me=False
    )

    # Store the new refresh token with access token info
    token_repo.create_refresh_token(
        user_id=current_user.id,
        token=refresh_token,
        token_id=token_id,
        expires_at=expires_at,
        device_id=None,
        access_token_jti=access_token_jti,
        access_token_expires_at=access_token_exp
    )

    # Set refresh token in HTTP-only cookie (same as login)
    cookie_days = settings.REFRESH_TOKEN_DAYS
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

    # Reset failed attempts on successful password change
    # Note: We don't have a direct reset method, but the lockout will expire naturally
    
    logger.info(f"Password changed successfully for user: {current_user.email}, all devices logged out")

    return {
        "message": "Password updated successfully. You have been logged out from all other devices.",
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user_id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "is_superuser": current_user.is_superuser,
        "is_verified": current_user.is_verified,
        "full_name": current_user.full_name if current_user.full_name else None
    }


def _blacklist_token_in_db(db: Session, jti: str, token_type: str, expires_at: datetime, reason: str = "password_change", user_id: str = None):
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