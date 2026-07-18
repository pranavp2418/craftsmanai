from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.team_settings import InvitationTokenResponse, MemberInvitationCreate
from app.services.team_settings_service import TeamSettingsService

router = APIRouter()


@router.post("/invitations", response_model=InvitationTokenResponse, status_code=status.HTTP_201_CREATED)
def invite_member(
    payload: MemberInvitationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TeamSettingsService(db)
    return service.invite_member(payload, current_user.id)
