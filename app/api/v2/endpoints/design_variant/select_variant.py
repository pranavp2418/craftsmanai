from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design_variant import DesignVariantSelectRequest, DesignVariantResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService


router = APIRouter()


@router.post("/variants/{variant_id}/select", response_model=DesignVariantResponse)
def select_design_variant(
    variant_id: int,
    payload: DesignVariantSelectRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    variant = variant_service.get_variant(variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    design = design_service.get_design_for_user(design_id=variant.design_id, user_id=current_user.id)
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")

    selected = variant_service.select_variant(variant, message=payload.message if payload else None)
    return selected
