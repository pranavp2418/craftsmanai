from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit
from app.schemas.auth import MessageResponse
from app.services.auth import AuthService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/logout", response_model=MessageResponse)
async def logout(
    *,
    db: Session = Depends(get_db),
    request: Request,
    response: Response
) -> Any:
    """
    Logout user by revoking both access and refresh tokens
    """
    
    # Check rate limit
    check_auth_rate_limit(request, "logout")
    
    # Get refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")
    access_token = request.headers.get("authorization", "").replace("Bearer ", "")
    
    if not refresh_token:
        logger.warning("Logout attempt without refresh token")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session found"
        )
    
    auth_service = AuthService(db)
    from app.core.security import decode_refresh_token, decode_access_token
    from app.core.token_blacklist import token_blacklist
    
    try:
        # Blacklist refresh token
        refresh_payload = decode_refresh_token(refresh_token)
        if refresh_payload:
            refresh_jti = refresh_payload.get("jti")
            refresh_exp = refresh_payload.get("exp")
            
            if refresh_jti:
                # Blacklist refresh token
                from datetime import datetime, timezone
                expires_at = datetime.fromtimestamp(refresh_exp, tz=timezone.utc)
                token_blacklist.blacklist_refresh_token(refresh_jti, expires_at)
                
                # Also revoke in database
                auth_service.token_repo.revoke_refresh_token(refresh_jti)
                logger.info(f"Blacklisted refresh token: {refresh_jti}")
        
        # Blacklist access token if provided
        if access_token:
            access_payload = decode_access_token(access_token)
            if access_payload:
                access_jti = access_payload.get("jti")
                if access_jti:
                    token_blacklist.blacklist_access_token(access_jti)
                    logger.info(f"Blacklisted access token: {access_jti}")
        
    except Exception as e:
        logger.error(f"Error during logout: {str(e)}")
    
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
