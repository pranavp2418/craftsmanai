from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamRolePermissionResponse
from app.services.retailer_team_service import RolePermissionService
from app.models.user import User

router = APIRouter()


@router.get("/roles", response_model=List[TeamRolePermissionResponse], tags=["roles"])
async def list_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available roles"""
    try:
        service = RolePermissionService(db)
        roles = service.get_all_roles(skip, limit)
        return roles
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
