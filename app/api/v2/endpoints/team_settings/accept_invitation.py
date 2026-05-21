from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.team_settings import AcceptInvitationRequest, AccountMemberResponse
from app.services.team_settings_service import TeamSettingsService

router = APIRouter()


@router.post("/invitations/accept", response_model=AccountMemberResponse, status_code=status.HTTP_200_OK)
def accept_invitation(
    payload: AcceptInvitationRequest,
    db: Session = Depends(get_db),
):
    service = TeamSettingsService(db)
    return service.accept_invitation(payload.token)
