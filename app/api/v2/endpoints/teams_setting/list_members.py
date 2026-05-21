from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamMemberResponse
from app.services.retailer_team_service import TeamService, TeamMemberService
from app.models.user import User

router = APIRouter()


@router.get("/teams/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_members(
    team_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all members of a team"""
    try:
        service = TeamService(db)
        
        if not service.is_team_member(team_id, current_user.id) and not service.is_team_owner(team_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this team"
            )
        
        member_service = TeamMemberService(db)
        members = member_service.get_team_members(team_id, skip, limit)
        return members
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
