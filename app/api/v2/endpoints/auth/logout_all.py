from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.rate_limiter import check_auth_rate_limit
from app.core.dependencies import get_current_user
from app.schemas.auth import MessageResponse
from app.services.auth import AuthService
from app.core.token_blacklist import token_blacklist
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all_devices(
    *,
    db: Session = Depends(get_db),
    request: Request,
    response: Response,
    current_user = Depends(get_current_user)
) -> Any:
    """
    Logout from all devices by blacklisting all user tokens
    """
    
    # Check rate limit
    check_auth_rate_limit(request, "logout_all")
    
    auth_service = AuthService(db)
    
    try:
        # Blacklist all tokens for this user
        token_blacklist.blacklist_user_all_tokens(str(current_user.id))
        
        # Revoke all refresh tokens in database
        revoked_count = auth_service.token_repo.revoke_all_user_tokens(current_user.id)
        
        logger.info(f"User {current_user.email} logged out from all devices, revoked {revoked_count} tokens")
        
    except Exception as e:
        logger.error(f"Error during logout all: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to logout from all devices"
        )
    
    # Clear cookies
    response.delete_cookie(
        key="refresh_token",
        path="/",
        httponly=True,
        samesite="Lax"
    )
    
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="Lax"
    )
    
    return MessageResponse(message="Logged out from all devices successfully")
