from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design_variant import DesignVariantRefineRequest, DesignVariantResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.tasks.design_tasks import refine_design_variant_image


router = APIRouter()


@router.post("/{design_id}/variants/refine", response_model=DesignVariantResponse, status_code=status.HTTP_201_CREATED)
def refine_design_variant(
    design_id: int,
    payload: DesignVariantRefineRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    design = design_service.get_design_for_team_member(design_id=design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    parent_variant = variant_service.get_variant(payload.parent_variant_id)
    if not parent_variant or parent_variant.design_id != design.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent variant not found")

    # Create the variant record synchronously to get the variant_id
    variant = variant_service.refine_variant(
        design_id=design.id,
        parent_variant_id=parent_variant.id,
        prompt_used=payload.prompt_used,
        model_used=payload.model_used,
        base_design_image_url=payload.base_design_image_url,
        style_tags=payload.style_tags if payload.style_tags else None,
        design_focus=payload.design_focus if payload.design_focus else None,
    )

    # Dispatch background AI generation task on variant-specific SSE channel
    channel = f"variant:{variant.id}"
    refine_design_variant_image.delay(
        design_id=design.id,
        variant_id=variant.id,
        parent_variant_id=parent_variant.id,
        prompt=payload.prompt_used,
        model_used=payload.model_used or "gpt-image-1.5",
        style_tags=payload.style_tags,
        design_focus=payload.design_focus,
        channel=channel,
    )

    return variant
