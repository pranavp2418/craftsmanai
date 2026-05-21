from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamInvitationResponse
from app.services.retailer_team_service import TeamService, TeamInvitationService
from app.models.user import User

router = APIRouter()


@router.get("/teams/{team_id}/invitations", response_model=List[TeamInvitationResponse], tags=["invitations"])
async def list_invitations(
    team_id: int,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get pending invitations for a team"""
    try:
        service = TeamService(db)
        
        if not service.is_team_admin(team_id, current_user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only team admin can view invitations"
            )
        
        invite_service = TeamInvitationService(db)
        invitations = invite_service.repo.get_team_invitations(team_id, status_filter, skip, limit)
        
        return [
            {
                "id": inv.id,
                "team_id": inv.team_id,
                "email": inv.email,
                "role": inv.role.value if hasattr(inv.role, 'value') else inv.role,
                "status": inv.status.value,
                "expires_at": inv.expires_at,
                "created_at": inv.created_at,
                "updated_at": inv.updated_at
            }
            for inv in invitations
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
