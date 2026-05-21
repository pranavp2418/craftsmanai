from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamMemberUpdate, TeamMemberResponse
from app.services.retailer_team_service import TeamService, TeamMemberService
from app.models.user import User

router = APIRouter()


@router.put("/teams/{team_id}/members/{user_id}", response_model=TeamMemberResponse)
async def update_member_role(
    team_id: int,
    user_id: int,
    member_data: TeamMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update member role"""
    try:
        service = TeamService(db)
        member_service = TeamMemberService(db)
        
        if not service.is_team_admin(team_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only team admin can update member roles"
            )
        
        result = member_service.update_member_role(team_id, user_id, member_data)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
