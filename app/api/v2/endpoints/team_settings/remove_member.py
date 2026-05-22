from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.team_settings_service import TeamSettingsService

router = APIRouter()


@router.delete("/teams/{invited_by}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    invited_by: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    service = TeamSettingsService(db)
    service.remove_member(invited_by=invited_by, user_id=user_id, current_user_id=current_user.id)
    return None
