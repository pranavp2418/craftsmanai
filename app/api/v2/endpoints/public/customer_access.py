from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.public import (
    PublicDesignAccessRequest,
    PublicDesignFullResponse,
    PublicDesignAccessResponse,
    PublicDesignVariantResponse,
)
from app.services.design_sharing_service import DesignSharingService
from app.services.design_variant_service import DesignVariantService

router = APIRouter()


@router.post("/customer/access", response_model=PublicDesignFullResponse)
def customer_access_design(
    payload: PublicDesignAccessRequest,
    db: Session = Depends(get_db),
):
    """Public endpoint for customers to access a shared design via token."""
    share_service = DesignSharingService(db)
    variant_service = DesignVariantService(db)

    share = share_service.get_by_token(payload.token)
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired share token",
        )

    design = share.design
    if not design:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Design not found",
        )

    variants = variant_service.list_variants(design_id=design.id)
    variant_responses = [
        PublicDesignVariantResponse(
            id=v.id,
            variant_name=v.variant_name,
            version_number=v.version_number,
            base_design_image_url=v.base_design_image_url,
            angles_json=v.angles_json,
            metal_variations_json=v.metal_variations_json,
            is_selected=v.is_selected,
            created_at=v.created_at,
        )
        for v in variants
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