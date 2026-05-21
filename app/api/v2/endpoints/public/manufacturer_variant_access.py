from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.public import (
    PublicDesignFullResponse,
    PublicDesignAccessResponse,
    PublicDesignVariantResponse,
)
from app.schemas.manufacturer_variant_share import (
    ManufacturerQuoteSubmitRequest,
)
from app.services.manufacturer_variant_share_service import DesignVariantManufacturerShareService

router = APIRouter()


@router.get("/manufacturer/variant/access", response_model=PublicDesignFullResponse)
def manufacturer_access_shared_variant(
    share_token: str = Query(
        ...,
        min_length=1,
        description="The share token received from the designer",
    ),
    db: Session = Depends(get_db),
):
    """Public endpoint for a manufacturer to view a shared design variant.

    The share token is passed as a query parameter:
    ``GET /public/manufacturer/variant/access?share_token=<token>``

    Returns the variant details including angles, metal variations, and
    design information.
    """
    share_service = DesignVariantManufacturerShareService(db)

    share = share_service.get_by_token(share_token)
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid share token",
        )

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

    # Return only the shared variant
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
        share_status=None,  # Manufacturer share uses its own status
        share_comment=share.notes,
        public_token=share.public_token,
    )


@router.post("/manufacturer/variant/quote", response_model=dict)
def manufacturer_submit_quote(
    payload: ManufacturerQuoteSubmitRequest,
    db: Session = Depends(get_db),
):
    """Public endpoint for a manufacturer to submit a quote for a shared variant.

    The manufacturer uses the share token (received from the designer) to
    submit their pricing, delivery time, and notes.
    """
    share_service = DesignVariantManufacturerShareService(db)

    share = share_service.get_by_token(payload.share_token)
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid share token",
        )

    if share.status.value != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quote has already been submitted (status: {share.status.value})",
        )

    updated = share_service.submit_quote(
        share,
        cost_price=payload.cost_price,
        delivery_time_days=payload.delivery_time_days,
        notes=payload.notes,
    )

    return {
        "success": True,
        "message": "Quote submitted successfully",
        "share_id": updated.id,
        "design_variant_id": updated.design_variant_id,
        "manufacturer_id": updated.manufacturer_id,
        "status": updated.status.value,
        "cost_price": updated.cost_price,
        "delivery_time_days": updated.delivery_time_days,
    }