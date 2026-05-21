from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user
from app.services.retailer_team_service import RolePermissionService
from app.models.user import User

router = APIRouter()


@router.get("/roles/defaults", response_model=dict, tags=["roles"])
async def get_default_roles(
    current_user: User = Depends(get_current_user)
):
    """Get default team roles"""
    service = RolePermissionService(None)
    return service.get_default_roles()
