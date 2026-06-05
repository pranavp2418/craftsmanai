from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design_variant import DesignVariantResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.services.storage_service import upload_images_to_supabase
from app.tasks.design_tasks import refine_design_variant_image


router = APIRouter()


@router.post("/{design_id}/variants/refine", response_model=DesignVariantResponse, status_code=status.HTTP_201_CREATED)
async def refine_design_variant(
    design_id: int,
    parent_variant_id: int = Form(...),
    prompt_used: Optional[str] = Form(None),
    model_used: Optional[str] = Form(None),
    base_design_image_url: Optional[str] = Form(None),
    style_tags: Optional[str] = Form(None),
    design_focus: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    design = design_service.get_design_for_team_member(design_id=design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    parent_variant = variant_service.get_variant(parent_variant_id)
    if not parent_variant or parent_variant.design_id != design.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent variant not found")

    # Upload reference images to Supabase (same pattern as create_design)
    reference_urls = []
    if files:
        if len(files) > 2:
            raise HTTPException(status_code=400, detail="Only up to 2 reference images allowed.")
        file_bytes_list = []
        for file in files:
            content = await file.read()
            if content:
                file_bytes_list.append(content)

        if file_bytes_list:
            reference_urls = upload_images_to_supabase(
                file_bytes_list,
                bucket_prefix=f"reference-images/user_{current_user.id}/refine",
            )

    # Create the variant record synchronously to get the variant_id
    variant = variant_service.refine_variant(
        design_id=design.id,
        parent_variant_id=parent_variant.id,
        prompt_used=prompt_used,
        model_used=model_used,
        base_design_image_url=base_design_image_url,
        style_tags=style_tags if style_tags else None,
        design_focus=design_focus if design_focus else None,
        reference_images_json=reference_urls if reference_urls else None,
    )

    # Resolve reference images for AI:
    # The parent variant's image MUST be the first (primary) image in refinement, serving as the master visual truth.
    ai_reference_images = []
    if parent_variant.base_design_image_url:
        ai_reference_images.append(parent_variant.base_design_image_url)
    
    # Append any user-provided reference images as secondary resources
    if reference_urls:
        ai_reference_images.extend(reference_urls)
        
    # If the parent variant had no image (e.g. edge cases), fall back to design's input images
    if not ai_reference_images:
        if design.input_image_urls:
            ai_reference_images = design.input_image_urls if isinstance(design.input_image_urls, list) else [design.input_image_urls]
        elif design.input_image_url:
            ai_reference_images = [design.input_image_url]


    # Dispatch background AI generation task on variant-specific SSE channel
    channel = f"variant:{variant.id}"
    refine_design_variant_image.delay(
        design_id=design.id,
        variant_id=variant.id,
        parent_variant_id=parent_variant.id,
        prompt=prompt_used,
        model_used=model_used or "gpt-image-1.5",
        style_tags=style_tags,
        design_focus=design_focus,
        reference_images=ai_reference_images,
        channel=channel,
    )

    return variant