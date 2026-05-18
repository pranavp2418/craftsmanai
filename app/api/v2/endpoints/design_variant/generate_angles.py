from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.tasks.angle_variant_tasks import generate_remaining_variant_angles


router = APIRouter()


@router.post("/variants/{variant_id}/angles", response_model=dict)
def generate_variant_angles(
    variant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    variant = variant_service.get_variant(variant_id)
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    design = design_service.get_design_for_user(design_id=variant.design_id, user_id=current_user.id)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    channel = f"variant_angles:{variant_id}"
    generate_remaining_variant_angles.delay(
        variant_id=variant.id,
        channel=channel,
    )
    return {
        "success": True,
        "message": f"Remaining angle generation started for variant_id={variant.id}",
        "variant_id": variant.id,
        "sse_channel": channel,
        "angles_to_generate": ["side_view", "top_view", "three_quarter_view"],
    }
