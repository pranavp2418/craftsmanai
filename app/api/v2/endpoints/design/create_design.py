from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design import DesignCreateRequest, DesignResponse
from app.services.ai_workflow_service import AIGenerationWorkflowService
from app.services.design_service import DesignService
from app.services.storage_service import upload_images_to_supabase
from app.tasks.design_tasks import generate_design_base_image


router = APIRouter()


@router.post("/", response_model=DesignResponse, status_code=status.HTTP_201_CREATED)
def create_design(
    payload: DesignCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    design_service = DesignService(db)

    # Validate and upload reference images to Supabase before persisting design
    reference_urls = upload_images_to_supabase(
        payload.images,
        bucket_prefix=f"reference-images/user_{current_user.id}",
    )

    design = design_service.create_design(
        user=current_user,
        name=payload.name,
        jewellery_type=payload.jewellery_type,
        user_prompt=payload.user_prompt,
        input_image_url=reference_urls[0],
        input_image_urls=reference_urls,
    )

    # Mark generation workflow as started immediately.
    AIGenerationWorkflowService(db).start_generation(design, prompt=payload.user_prompt)

    # Enqueue background generation task.
    generate_design_base_image.apply_async(
        kwargs={
            "design_id": design.id,
            "prompt": payload.user_prompt,
            "channel": f"design_{design.id}",
        }
    )

    return design
