from fastapi import APIRouter, Depends, status, Form, File, UploadFile
from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi import HTTPException

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design import DesignResponse
from app.services.ai_workflow_service import AIGenerationWorkflowService
from app.services.design_service import DesignService
from app.services.storage_service import upload_images_to_supabase
from app.tasks.design_tasks import generate_design_base_image


router = APIRouter()


@router.post("/", response_model=DesignResponse, status_code=status.HTTP_201_CREATED)
async def create_design(
    name: str = Form(None),
    jewellery_type: str = Form(...),
    user_prompt: str = Form(None),
    files: List[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.services.subscription_service import SubscriptionService
    SubscriptionService.check_and_deduct_tokens(db, current_user, 1)

    design_service = DesignService(db)

    reference_urls = []

    # Read uploaded file bytes and pass them to standard validation/upload flow
    if files:
        if files.__len__() > 2:
            raise HTTPException(status_code=400, detail="Only up to 2 reference images allowed.")
        file_bytes_list = []
        for file in files:
            content = await file.read()
            if content:
                file_bytes_list.append(content)
        
        if file_bytes_list:
            reference_urls = upload_images_to_supabase(
                file_bytes_list,
                bucket_prefix=f"reference-images/user_{current_user.id}",
            )

    design = design_service.create_design(
        user=current_user,
        name=name,
        jewellery_type=jewellery_type,
        user_prompt=user_prompt if user_prompt else None,
        input_image_url=reference_urls[0] if reference_urls else None,
        input_image_urls=reference_urls,
    )

    # Mark generation workflow as started immediately.
    AIGenerationWorkflowService(db).start_generation(
        design,
        prompt=user_prompt,
    )

    # Enqueue background generation task.
    generate_design_base_image.apply_async(
        kwargs={
            "design_id": design.id,
            "prompt": user_prompt,
            "channel": f"design_{design.id}",
        }
    )

    return design