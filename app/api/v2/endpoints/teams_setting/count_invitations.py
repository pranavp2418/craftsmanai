from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.services.retailer_team_service import TeamInvitationService
from app.models.user import User

router = APIRouter()


@router.get("/invitations/me/count", response_model=dict, tags=["invitations"])
async def count_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get count of pending invitations for current user"""
    try:
        invite_service = TeamInvitationService(db)
        invitations = invite_service.get_pending_invitations_for_email(current_user.email)
        
        return {
            "pending_count": len(invitations),
            "invitations": invitations
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
