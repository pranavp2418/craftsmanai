import logging
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
logger = logging.getLogger(__name__)


@router.post("/{design_id}/variants/refine", response_model=DesignVariantResponse, status_code=status.HTTP_201_CREATED)
async def refine_design_variant(
    design_id: int,
    parent_variant_id: int = Form(...),
    metal_variant: Optional[str] = Form(None),
    prompt_used: Optional[str] = Form(None),
    model_used: Optional[str] = Form(None),
    base_design_image_url: Optional[str] = Form(None),
    style_tags: Optional[str] = Form(None),
    design_focus: Optional[str] = Form(None),
    files: List[UploadFile] = File(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from app.services.subscription_service import SubscriptionService
    SubscriptionService.check_and_deduct_tokens(db, current_user, 1)

    design_service = DesignService(db)
    variant_service = DesignVariantService(db)

    design = design_service.get_design_for_team_member(design_id=design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    parent_variant = variant_service.get_variant(parent_variant_id)
    if not parent_variant or parent_variant.design_id != design.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent variant not found")

    def _extract_url(url_value):
        if isinstance(url_value, dict):
            return url_value.get("url")
        if isinstance(url_value, str):
            return url_value
        return None

    def _normalize_metal_key(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        return value.strip().lower().replace("-", "_").replace(" ", "_")

    # Resolve the source image that should be used as the primary refinement reference.
    # Priority:
    # 1) Requested metal variant image from parent variant (if metal_variant is provided)
    # 2) Explicit image URL from request
    # 3) Parent variant base image
    requested_metal_image_url = None
    requested_metal_key = _normalize_metal_key(metal_variant)
    if requested_metal_key and isinstance(parent_variant.metal_variations_json, dict):
        for key, value in parent_variant.metal_variations_json.items():
            if _normalize_metal_key(key) == requested_metal_key:
                requested_metal_image_url = _extract_url(value)
                if requested_metal_image_url:
                    break

    # The ORIGINAL design-input image(s) the user first uploaded must NEVER be the refine source —
    # a refine edits the CURRENT variant render, not the original upload. (The frontend sometimes
    # keeps the original attached and re-sends it; guard against that here.)
    _original_inputs = set()
    if design.input_image_urls:
        _original_inputs.update(design.input_image_urls if isinstance(design.input_image_urls, list) else [design.input_image_urls])
    if design.input_image_url:
        _original_inputs.add(design.input_image_url)

    resolved_source_image_url = requested_metal_image_url or base_design_image_url
    if resolved_source_image_url in _original_inputs:
        resolved_source_image_url = None  # ignore an original-input passed as the refine source

    if not resolved_source_image_url and parent_variant.base_design_image_url:
        resolved_source_image_url = parent_variant.base_design_image_url

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
        base_design_image_url=resolved_source_image_url,
        style_tags=style_tags if style_tags else None,
        design_focus=design_focus if design_focus else None,
        reference_images_json=reference_urls if reference_urls else None,
    )

    # Resolve reference images for AI. PRIMARY = the variant render being edited (or a selected
    # metal variant of it). The original design-input upload is EXCLUDED so a refine never edits the
    # original instead of the current render.
    ai_reference_images = []
    primary_reference = resolved_source_image_url or parent_variant.base_design_image_url
    if primary_reference and primary_reference not in _original_inputs:
        ai_reference_images.append(primary_reference)

    # If the user uploaded reference image(s) in THIS refine, pass them ALL straight to the model
    # together with the client's prompt — no keyword gating. The user attached them on purpose; the
    # model decides how to use them per the prompt (merge / replace an element / take a style etc.).
    # (We only skip any that exactly match the ORIGINAL design upload, which must never be a refine
    # source.) NOTE: this assumes the frontend sends `files` ONLY when the user actually picks an
    # image — it should not auto-attach an image on a plain text edit.
    if reference_urls:
        ai_reference_images.extend([u for u in reference_urls if u not in _original_inputs])

    # Edge case: parent variant has no render at all — fall back to the original input.
    if not ai_reference_images:
        if design.input_image_urls:
            ai_reference_images = design.input_image_urls if isinstance(design.input_image_urls, list) else [design.input_image_urls]
        elif design.input_image_url:
            ai_reference_images = [design.input_image_url]
        else:
            ai_reference_images = None

    logger.info(
        "[refine] variant=%s refs=%d uploaded_files=%d",
        variant.id, len(ai_reference_images or []), len(reference_urls or []),
    )


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