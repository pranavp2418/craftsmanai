from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from typing import Any
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit
from app.core.device_fingerprint import get_device_info_from_request
from app.schemas.auth import RefreshTokenRequest, LoginResponse
from app.services.auth import AuthService
from app.core.token_blacklist import token_blacklist
from app.models.blacklisted_token import BlacklistedToken
import logging
from jose import ExpiredSignatureError, JWTError

logger = logging.getLogger(__name__)

router = APIRouter()


def _blacklist_token_in_db(db: Session, jti: str, token_type: str, expires_at: datetime, reason: str = "refresh", user_id: str = None):
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


@router.post("/refresh-token", response_model=LoginResponse)
async def refresh_token(
    *,
    db: Session = Depends(get_db),
    device_info: RefreshTokenRequest,
    request: Request,
    response: Response
) -> Any:
    """
    Refresh access token using refresh token from cookie
    """
    
    # Check rate limit
    check_auth_rate_limit(request, "refresh_token")
    
    # Get refresh token from cookie or alternative header
    refresh_token = request.cookies.get("refresh_token") or request.headers.get("X-Refresh-Token")
    
    logger.info(f"Refresh token present: {bool(refresh_token)}")
    
    if not refresh_token:
        logger.warning("Refresh token attempt without token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided"
        )
    
    auth_service = AuthService(db)
    
    # Verify refresh token (includes blacklist check in decode_refresh_token)
    from app.core.security import decode_refresh_token
    try:
        payload = decode_refresh_token(refresh_token)
        logger.info(f"Decoded refresh payload: {payload}")
        if not payload:
            logger.warning("Invalid or blacklisted refresh token provided")
            logger.info(f"Refresh token value: {refresh_token}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
    except Exception as e:
        logger.warning(f"Refresh token error: {str(e)}")
        logger.info(f"Refresh token value: {refresh_token}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Get user ID from payload
    sub_value = payload.get("sub")
    logger.debug(f"Refresh token sub value: {sub_value}")
    try:
        user_id = int(sub_value)
    except (TypeError, ValueError):
        logger.warning(f"Refresh token sub claim invalid: {sub_value}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Fetch user from database
    from app.repositories.user import UserRepository
    user_repo = UserRepository(db)
    user = user_repo.get_user_by_id(user_id)
    logger.debug(f"User lookup for refresh token user_id={user_id}: {user}")
    
    if not user:
        logger.warning(f"Refresh token user not found: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Create new access token
    from app.core.security import create_access_token
    access_token = create_access_token(data={"sub": str(user_id), "email": user.email})
    
    logger.info(f"Access token refreshed for user: {user.email}")
    
    from app.core.config import settings
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=str(user_id),
        email=user.email,
        username=user.username,
        is_superuser=user.is_superuser,
        is_verified=user.is_verified,
        notification_message="Token refreshed successfully",
        profile_image_url=None
    )