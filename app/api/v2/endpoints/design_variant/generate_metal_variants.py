import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.sse_manager import sse_manager
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

    channel = f"metal_variants:{variant_id}"

    if not missing_metals:
        # Data already exists — publish via SSE after a short delay so the
        # frontend has time to subscribe to the channel, then return.
        time.sleep(2)
        sse_manager.publish(
            channel,
            data={
                "variant_id": variant.id,
                "design_id": variant.design_id,
                "status": "GENERATED",
                "message": "All requested metals already exist. Returning existing data.",
                "metal_variations": existing_metal_variations,
                "from_cache": True,
            },
            event="metal_variants.generated",
        )
        sse_manager.publish_close(channel)
        return {
            "success": True,
            "message": "All requested metals already exist. Returning existing data via SSE.",
            "variant_id": variant.id,
            "metals": payload.metals,
            "already_existing": already_existing,
            "skipped": True,
            "sse_channel": channel,
        }

    # Deduct subscription tokens (1 per missing metal to generate)
    from app.services.subscription_service import SubscriptionService
    SubscriptionService.check_and_deduct_tokens(db, current_user, len(missing_metals))

    # Dispatch the background Celery task with only the missing metals
    # generate_metal_variant_images.delay(
    #     variant_id=variant.id,
    #     metals=missing_metals,
    #     channel=channel,
    # Dispatch the background Celery task with only the missing metals.
    # Route to the dedicated metal-variants queue so it runs on worker-variants
    # instead of blocking the primary render worker.
    generate_metal_variant_images.apply_async(
        kwargs={
            "variant_id": variant.id,
            "metals": missing_metals,
            "channel": channel,
        },
        queue="metal_variants",
    )

    return {
        "success": True,
        "message": f"Metal variant generation started for variant_id={variant_id}",
        "variant_id": variant.id,
        "metals": missing_metals,
        "already_existing": already_existing,
        "sse_channel": channel,
    }
