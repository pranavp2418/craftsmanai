from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.services.retailer_team_service import TeamService, TeamInvitationService
from app.models.user import User

router = APIRouter()


@router.delete("/teams/{team_id}/invitations/{email}", status_code=status.HTTP_204_NO_CONTENT, tags=["invitations"])
async def cancel_invitation(
    team_id: int,
    email: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel pending invitation"""
    try:
        service = TeamService(db)
        invite_service = TeamInvitationService(db)
        
        if not service.is_team_admin(team_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only team admin can cancel invitations"
            )
        
        success = invite_service.cancel_invitation(team_id, email)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation not found"
            )
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
