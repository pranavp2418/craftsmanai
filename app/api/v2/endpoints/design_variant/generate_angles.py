from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design_variant import DesignVariantAngleGenerationRequest
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.tasks.angle_variant_tasks import generate_remaining_variant_angles


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

    channel = f"variant_angles:{variant_id}"
    generate_remaining_variant_angles.delay(
        variant_id=variant.id,
        metals=payload.metals,
        channel=channel,
    )
    return {
        "success": True,
        "message": f"Angle generation started for variant_id={variant.id}",
        "variant_id": variant.id,
        "metals": payload.metals,
        "sse_channel": channel,
        "angles_to_generate": ["side_view", "top_view", "three_quarter_view"],
    }
