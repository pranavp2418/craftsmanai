from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamUpdate, TeamDetailResponse
from app.services.retailer_team_service import TeamService
from app.models.user import User

router = APIRouter()


@router.put("/teams/{team_id}", response_model=TeamDetailResponse, tags=["teams"])
async def update_team(
    team_id: int,
    team_data: TeamUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update team details"""
    try:
        service = TeamService(db)
        
        if not service.is_team_owner(team_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only team owner can update team"
            )
        
        team = service.update_team(team_id, team_data)
        if not team:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Team not found"
            )
        
        return team
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
