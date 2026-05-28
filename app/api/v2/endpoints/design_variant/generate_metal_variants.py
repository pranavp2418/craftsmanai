from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design_variant import DesignVariantMetalGenerationRequest, DesignVariantResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.tasks.metal_variant_tasks import generate_metal_variant_images


router = APIRouter()


@router.post("/variants/{variant_id}/metals", response_model=dict)
def generate_metal_variants(
    variant_id: int,
    payload: DesignVariantMetalGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate metal variant images in the background via Celery.

    Accepts a list of metals (e.g. ``["gold", "silver", "rose_gold"]``).
    The AI generation runs asynchronously in a Celery worker.  Once
    complete, an SSE event is published on the channel
    ``metal_variants:<variant_id>``.
    """
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    variant = variant_service.get_variant(variant_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    design = design_service.get_design_for_team_member(design_id=variant.design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")

    if not payload.metals:
        raise HTTPException(status_code=400, detail="At least one metal must be specified")

    # Check which requested metals already exist (skip regeneration)
    existing_metal_variations = variant.metal_variations_json or {}
    already_existing = [m for m in payload.metals if m in existing_metal_variations and existing_metal_variations[m] is not None]
    missing_metals = [m for m in payload.metals if m not in already_existing]

    if not missing_metals:
        return {
            "success": True,
            "message": "All requested metals already exist. No generation needed.",
            "variant_id": variant.id,
            "metals": payload.metals,
            "already_existing": already_existing,
            "skipped": True,
        }

    channel = f"metal_variants:{variant_id}"

    # Dispatch the background Celery task with only the missing metals
    generate_metal_variant_images.delay(
        variant_id=variant.id,
        metals=missing_metals,
        channel=channel,
    )

    return {
        "success": True,
        "message": f"Metal variant generation started for variant_id={variant_id}",
        "variant_id": variant.id,
        "metals": missing_metals,
        "already_existing": already_existing,
        "sse_channel": channel,
    }
