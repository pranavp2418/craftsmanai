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

    # Return only the shared variant (not all variants)
    variant_responses = [
        PublicDesignVariantResponse(
            id=variant.id,
            variant_name=variant.variant_name,
            version_number=variant.version_number,
            base_design_image_url=variant.base_design_image_url,
            angles_json=variant.angles_json,
            metal_variations_json=variant.metal_variations_json,
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

    return PublicDesignFullResponse(
        design=design_response,
        variants=variant_responses,
        share_status=share.status,
        share_comment=share.comment,
        public_token=share.public_token,
    )