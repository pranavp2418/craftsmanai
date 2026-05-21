from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamRolePermissionCreate, TeamRolePermissionResponse
from app.services.retailer_team_service import RolePermissionService
from app.models.user import User

router = APIRouter()


@router.post("/roles", response_model=TeamRolePermissionResponse, status_code=status.HTTP_201_CREATED, tags=["roles"])
async def create_role(
    role_data: TeamRolePermissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new role (superuser only)"""
    try:
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only superusers can create roles"
            )
        
        service = RolePermissionService(db)
        result = service.create_role(role_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
