from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamInvitationResponse
from app.services.retailer_team_service import TeamInvitationService
from app.models.user import User

router = APIRouter()


@router.get("/invitations/me", response_model=List[TeamInvitationResponse], tags=["invitations"])
async def get_my_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pending invitations for current user"""
    try:
        invite_service = TeamInvitationService(db)
        invitations = invite_service.get_pending_invitations_for_email(current_user.email)
        
        return [
            {
                "id": inv["id"],
                "team_id": inv["team_id"],
                "email": inv["email"],
                "role": inv["role"],
                "status": inv["status"],
                "expires_at": inv["expires_at"],
                "created_at": inv["created_at"],
                "updated_at": inv["updated_at"]
            }
            for inv in invitations
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
