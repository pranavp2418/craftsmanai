from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.public import (
    PublicDesignFullResponse,
    PublicDesignAccessResponse,
    PublicDesignVariantResponse,
)
from app.services.design_sharing_service import DesignSharingService
from app.services.design_variant_service import DesignVariantService

router = APIRouter()


@router.get("/customer/access", response_model=PublicDesignFullResponse)
def customer_access_design(
    token: str = Query(..., min_length=1, description="The share token received from the designer"),
    db: Session = Depends(get_db),
):
    """Public endpoint for customers to access a shared design via token.

    The token is passed as a query parameter:
    ``GET /public/customer/access?token=<share_token>``
    """
    share_service = DesignSharingService(db)
    variant_service = DesignVariantService(db)

    share = share_service.get_by_token(token)
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired share token",
        )

    # The share is linked to a specific variant
    variant = share.design_variant
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared variant not found",
        )

    design = variant.design
    if not design:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Design not found",
        )

    # ------------------------------------------------------------------
    # If the share was created for a specific metal, filter the variant's
    # metal_variations_json and angles_json to only include that metal.
    # ------------------------------------------------------------------
    shared_metal = share.shared_metal
    filtered_metal_variations = variant.metal_variations_json
    filtered_angles = variant.angles_json

    if shared_metal:
        # Normalize to lowercase for consistent lookup
        shared_metal_lower = shared_metal.lower()

        # Only return the shared metal's variation (case-insensitive lookup)
        if isinstance(filtered_metal_variations, dict):
            # Find the correct key matching case-insensitively
            metal_value = None
            for key in filtered_metal_variations:
                if key.lower() == shared_metal_lower:
                    metal_value = filtered_metal_variations[key]
                    break
            filtered_metal_variations = {shared_metal_lower: metal_value}

        # Only return angles for the shared metal (case-insensitive lookup)
        if isinstance(filtered_angles, dict):
            angles_value = None
            for key in filtered_angles:
                if key.lower() == shared_metal_lower:
                    angles_value = filtered_angles[key]
                    break
            filtered_angles = {shared_metal_lower: angles_value}

    # Return only the shared variant (not all variants)
    variant_responses = [
        PublicDesignVariantResponse(
            id=variant.id,
            variant_name=variant.variant_name,
            version_number=variant.version_number,
            base_design_image_url=variant.base_design_image_url,
            angles_json=filtered_angles,
            metal_variations_json=filtered_metal_variations,
            is_selected=variant.is_selected,
            created_at=variant.created_at,
        )
    ]

    design_response = PublicDesignAccessResponse(
        design_id=design.id,
        design_code=design.design_code,
        name=design.name,
        jewellery_type=design.jewellery_type,
        user_prompt=design.user_prompt,
        input_image_url=design.input_image_url,
        status=design.status,
    )


    from app.repositories.brand_setting import BrandSettingRepository
    brand_setting = BrandSettingRepository(db).get_by_user_id(design.user_id)

    return PublicDesignFullResponse(
        design=design_response,
        variants=variant_responses,
        share_status=share.status,
        share_comment=share.comment,
        public_token=share.public_token,
        brand_logo_url=brand_setting.logo_url if brand_setting else None,
        brand_primary_color=brand_setting.primary_color if brand_setting else "#6366F1",
    )