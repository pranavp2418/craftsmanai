from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.team_settings import AccountMemberResponse, MemberUpdateRequest
from app.services.team_settings_service import TeamSettingsService

router = APIRouter()


@router.patch("/teams/members/{user_id}", response_model=AccountMemberResponse)
def update_member(
    
    user_id: int,
    payload: MemberUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    invited_by = current_user.id
    service = TeamSettingsService(db)
    return service.update_member(invited_by=invited_by, user_id=user_id, payload=payload, current_user_id=current_user.id)
