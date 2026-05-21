from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamMemberCreate, TeamMemberResponse
from app.services.retailer_team_service import TeamService, TeamMemberService
from app.models.user import User

router = APIRouter()


@router.post("/teams/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED, tags=["members"])
async def add_member(
    team_id: int,
    member_data: TeamMemberCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a member to team"""
    try:
        service = TeamService(db)
        member_service = TeamMemberService(db)
        
        if not service.is_team_admin(team_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only team admin can add members"
            )
        
        result = member_service.add_member(team_id, member_data.user_id, member_data.role.value)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
