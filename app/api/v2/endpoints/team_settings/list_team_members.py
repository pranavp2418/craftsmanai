from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.team_settings import TeamMembersListResponse
from app.services.team_settings_service import TeamSettingsService

router = APIRouter()


@router.get("/teams/{invited_by}/members", response_model=TeamMembersListResponse)
def list_team_members(
    invited_by: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = TeamSettingsService(db)
    return service.list_members(invited_by=invited_by, current_user_id=current_user.id)
