from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import InvitationAcceptRequest
from app.services.retailer_team_service import TeamInvitationService
from app.models.user import User

router = APIRouter()


@router.post("/invitations/accept", response_model=dict, tags=["invitations"])
async def accept_invitation(
    request_data: InvitationAcceptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a team invitation"""
    try:
        invite_service = TeamInvitationService(db)
        result = invite_service.accept_invitation(request_data.token, current_user.id)
        
        return {
            "status": "success",
            "message": "Invitation accepted",
            "data": result
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
