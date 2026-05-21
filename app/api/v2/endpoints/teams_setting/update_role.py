from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.schemas.retailer_team import TeamRolePermissionCreate, TeamRolePermissionResponse
from app.services.retailer_team_service import RolePermissionService
from app.models.user import User

router = APIRouter()


@router.put("/roles/{role_id}", response_model=TeamRolePermissionResponse, tags=["roles"])
async def update_role(
    role_id: int,
    role_data: TeamRolePermissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update role details (superuser only)"""
    try:
        if not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only superusers can update roles"
            )
        
        service = RolePermissionService(db)
        result = service.update_role(role_id, role_data)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
            )
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
