from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design import DesignCreateRequest, DesignResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService


router = APIRouter()


@router.post("/", response_model=DesignResponse, status_code=status.HTTP_201_CREATED)
def create_design(
    payload: DesignCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    design = design_service.create_design(
        user=current_user,
        name=payload.name,
        jewellery_type=payload.jewellery_type,
        user_prompt=payload.user_prompt,
        input_image_url=payload.input_image_url,
        initial_prompt=payload.initial_prompt,
        initial_model=payload.initial_model,
        initial_image_url=payload.initial_image_url,
    )

    # Create initial variant (v0)
    variant_service.create_initial_variant(
        design_id=design.id,
        base_design_image_url=payload.initial_image_url,
        prompt_used=payload.initial_prompt,
        model_used=payload.initial_model,
    )

    return design
