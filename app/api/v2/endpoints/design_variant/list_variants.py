from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design_variant import DesignVariantListResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService


router = APIRouter()


@router.get("/{design_id}/variants", response_model=DesignVariantListResponse)
def list_design_variants(
    design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    design = design_service.get_design_for_team_member(design_id=design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    variants = variant_service.list_variants(design.id)
    return DesignVariantListResponse(items=variants)
