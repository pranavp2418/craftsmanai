from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.team_settings import TeamMembersListResponse
from app.services.team_settings_service import TeamSettingsService

router = APIRouter()


@router.get("/teams/members", response_model=TeamMembersListResponse)
def list_team_members(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    invited_by = current_user.id
    skip = (page - 1) * limit
    service = TeamSettingsService(db)
    return service.list_members(
        invited_by=invited_by,
        current_user_id=current_user.id,
        skip=skip,
        limit=limit,
        page=page,
    )
