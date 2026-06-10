import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.sse_manager import sse_manager
from app.models.user import User
from app.schemas.design_variant import DesignVariantAngleGenerationRequest
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.tasks.angle_variant_tasks import generate_remaining_variant_angles


ANGLE_PROMPTS = {
    "side_view",
    "top_view",
    "three_quarter_view",
}

router = APIRouter()


@router.post("/variants/{variant_id}/angles", response_model=dict)
def generate_variant_angles(
    variant_id: int,
    payload: DesignVariantAngleGenerationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Generate viewing angles per metal type in the background via Celery.

    Accepts a list of metals (e.g. ``["gold", "silver", "rose"]``).
    For each metal, all standard viewing angles (side, top, three-quarter)
    are generated via AI.  The results are stored in a nested structure
    under ``angles_json`` on the variant:

    .. code-block:: json

        {
          "gold": {
            "side_view": "https://...",
            "top_view": "https://...",
            "three_quarter_view": "https://..."
          },
          "silver": { ... },
          "rose": { ... }
        }

    Once complete, an SSE event is published on the channel
    ``variant_angles:<variant_id>``.
    """
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    variant = variant_service.get_variant(variant_id)
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    design = design_service.get_design_for_team_member(design_id=variant.design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    if not payload.metals:
        raise HTTPException(status_code=400, detail="At least one metal must be specified")

    # Check which requested metals already have all angles generated
    existing_angles = variant.angles_json or {}
    already_existing = []
    for metal in payload.metals:
        metal_data = existing_angles.get(metal)
        if isinstance(metal_data, dict) and all(
            angle in metal_data for angle in ANGLE_PROMPTS
        ):
            already_existing.append(metal)

    missing_metals = [m for m in payload.metals if m not in already_existing]

    channel = f"variant_angles:{variant_id}"

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
                "message": "All requested metals already have angles. Returning existing data.",
                "angles": existing_angles,
                "from_cache": True,
            },
            event="variant.angles.generated",
        )
        sse_manager.publish_close(channel)
        return {
            "success": True,
            "message": "All requested metals already have angles generated. Returning existing data via SSE.",
            "variant_id": variant.id,
            "metals": payload.metals,
            "already_existing": already_existing,
            "skipped": True,
            "sse_channel": channel,
        }

    # Route to the dedicated angle-variants queue so angle generation runs on
    # worker-angles instead of blocking the primary render worker.
    generate_remaining_variant_angles.apply_async(
        kwargs={
            "variant_id": variant.id,
            "metals": missing_metals,
            "channel": channel,
        },
        queue="angle_variants",
    )
    return {
        "success": True,
        "message": f"Angle generation started for variant_id={variant.id}",
        "variant_id": variant.id,
        "metals": missing_metals,
        "already_existing": already_existing,
        "sse_channel": channel,
        "angles_to_generate": ["side_view", "top_view", "three_quarter_view"],
    }
