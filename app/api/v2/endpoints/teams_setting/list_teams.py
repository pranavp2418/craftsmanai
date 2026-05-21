from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamDetailResponse
from app.services.retailer_team_service import TeamService
from app.models.user import User

router = APIRouter()


@router.get("/teams", response_model=List[TeamDetailResponse], tags=["teams"])
async def list_teams(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all teams for current user"""
    try:
        service = TeamService(db)
        teams = service.get_user_teams(current_user.id, skip, limit)
        return teams
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
