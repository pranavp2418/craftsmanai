from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from typing import Any
from datetime import datetime
from app.core.timezone import now as tz_now, CST_TZ

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit
from app.schemas.auth import MessageResponse
from app.services.auth import AuthService
from app.core.token_blacklist import token_blacklist
from app.models.blacklisted_token import BlacklistedToken
import logging
from jose import ExpiredSignatureError, JWTError

logger = logging.getLogger(__name__)

router = APIRouter()


def _decode_token_payload(token: str, decode_func):
    """
    Try to decode a token to extract its payload.
    Returns None if token is invalid (expired is allowed - we still get the payload).
    """
    try:
        return decode_func(token)
    except ExpiredSignatureError:
        from jose import jwt
        from app.core.config import settings
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_exp": False, "verify_signature": True}
            )
            return payload
        except JWTError:
            return None
    except Exception:
        return None


def _blacklist_token_in_db(db: Session, jti: str, token_type: str, expires_at: datetime, reason: str = "logout", user_id: str = None):
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


def _blacklist_access_token_jti(db: Session, jti: str, expires_at: datetime, reason: str = "logout", user_id: str = None):
    """Blacklist an access token by its JTI"""
    if not jti or not expires_at:
        return
    
    now = tz_now()
    remaining_seconds = max(int((expires_at - now).total_seconds()), 0)
    remaining_minutes = max(remaining_seconds // 60, 1)
    
    # Blacklist in Redis
    token_blacklist.blacklist_access_token(jti, remaining_minutes)
    
    # Blacklist in DB for audit trail
    _blacklist_token_in_db(db, jti, "access", expires_at, reason, user_id)
    
    logger.info(f"Blacklisted access token JTI: {jti} during {reason}")


def _deactivate_device(db: Session, auth_service: AuthService, user_id: int, device_id: str):
    """Deactivate the device associated with the revoked refresh token"""
    if device_id:
        try:
            device = auth_service.device_repo.get_device_by_device_id(user_id, device_id)
            if device:
                auth_service.device_repo.deactivate_device(user_id, device.id)
                logger.info(f"Deactivated device {device_id} for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to deactivate device {device_id}: {str(e)}")


@router.post("/logout", response_model=MessageResponse)
async def logout(
    *,
    db: Session = Depends(get_db),
    request: Request,
    response: Response
) -> Any:
    """
    Logout user by revoking refresh token and blacklisting the associated access token
    
    The access token JTI stored in the refresh_tokens table is automatically blacklisted.
    No separate X-Access-Token header is needed since access token is linked to the refresh token in DB.
    """
    
    # Check rate limit
    check_auth_rate_limit(request, "logout")
    
    # Get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")
    
    if not refresh_token:
        logger.warning("Logout attempt without refresh token")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session found"
        )
    
    auth_service = AuthService(db)
    from app.core.security import decode_refresh_token
    
    # Decode refresh token to get jti, exp, sub (user_id), and device info
    refresh_payload = _decode_token_payload(refresh_token, decode_refresh_token)
    if refresh_payload:
        refresh_jti = refresh_payload.get("jti")
        refresh_exp = refresh_payload.get("exp")
        user_id_from_token = refresh_payload.get("sub")
        
        if refresh_jti and refresh_exp:
            expires_at = datetime.fromtimestamp(refresh_exp, tz=CST_TZ)
            
            # 0. Blacklist the associated access token from DB
            if refresh_jti:
                token_record = auth_service.token_repo.get_refresh_token_by_id(refresh_jti)
                if token_record and token_record.access_token_jti and token_record.access_token_expires_at:
                    _blacklist_access_token_jti(
                        db,
                        token_record.access_token_jti,
                        token_record.access_token_expires_at,
                        "logout",
                        user_id_from_token
                    )
            
            # 1. Blacklist in Redis
            token_blacklist.blacklist_refresh_token(refresh_jti, expires_at)
            
            # 2. Get the refresh token record to find device_id before revoking
            device_id = None
            if user_id_from_token:
                try:
                    token_record = auth_service.token_repo.get_refresh_token_by_id(refresh_jti)
                    if token_record:
                        device_id = token_record.device_id
                except Exception as e:
                    logger.error(f"Failed to get token record: {str(e)}")
            
            # 3. Revoke in refresh_tokens table
            auth_service.token_repo.revoke_refresh_token(refresh_jti)
            
            # 4. Insert into blacklisted_tokens table for persistence
            _blacklist_token_in_db(db, refresh_jti, "refresh", expires_at, "logout", user_id_from_token)
            
            # 5. Deactivate the associated device
            if device_id and user_id_from_token:
                _deactivate_device(db, auth_service, int(user_id_from_token), device_id)
            
            logger.info(f"Logged out and blacklisted refresh token {refresh_jti}")
    else:
        logger.warning("Could not decode refresh token for blacklisting")
    
    # Clear refresh token cookie
    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        samesite="Lax"
    )
    
    # Clear access token cookie if exists
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="Lax"
    )
    
    return MessageResponse(message="Logged out successfully")