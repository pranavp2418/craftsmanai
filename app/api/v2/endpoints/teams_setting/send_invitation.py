from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamInvitationCreate
from app.services.retailer_team_service import TeamService, TeamInvitationService
from app.models.user import User

router = APIRouter()


@router.post("/teams/{team_id}/invitations", response_model=dict, status_code=status.HTTP_201_CREATED)
async def send_invitation(
    team_id: int,
    invitation_data: TeamInvitationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send team invitation via email"""
    try:
        service = TeamService(db)
        invite_service = TeamInvitationService(db)
        
        if not service.is_team_admin(team_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only team admin can send invitations"
            )
        
        result = invite_service.create_invitation(team_id, invitation_data, current_user.id, send_email=True)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
