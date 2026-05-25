from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.models.user import User
from app.models.refresh_token import RefreshToken

router = APIRouter()

@router.get("/sessions", status_code=status.HTTP_200_OK)
def get_active_sessions(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all active sessions for the currently logged-in user.
    """
    sessions = db.query(RefreshToken).filter(RefreshToken.user_id == current_user.id).all()
    
    return [
        {
            "id": session.id,
            "user_id": session.user_id,
            "created_at": session.created_at,
            "expires_at": session.expires_at,
            "is_revoked": session.revoked_at is not None
        }
        for session in sessions
        if session.revoked_at is None
    ]
