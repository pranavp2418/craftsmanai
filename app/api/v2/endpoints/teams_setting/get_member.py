from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamMemberResponse
from app.services.retailer_team_service import TeamService, TeamMemberService
from app.models.user import User

router = APIRouter()


@router.get("/teams/{team_id}/members/{user_id}", response_model=TeamMemberResponse, tags=["members"])
async def get_member(
    team_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific team member details"""
    try:
        service = TeamService(db)
        
        if not service.is_team_member(team_id, current_user.id) and not service.is_team_owner(team_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this team"
            )
        
        member_service = TeamMemberService(db)
        member = member_service.get_member(team_id, user_id)
        
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )
        
        return member
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
