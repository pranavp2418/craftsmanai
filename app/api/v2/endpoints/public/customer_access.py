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

    # Get the creator's name
    created_by_name = None
    if design.user_id:
        from app.models.user import User
        creator = db.query(User).filter(User.id == design.user_id).first()
        if creator:
            created_by_name = creator.full_name or creator.email

    design_response = PublicDesignAccessResponse(
        design_id=design.id,
        design_code=design.design_code,
        name=design.name,
        jewellery_type=design.jewellery_type,
        user_prompt=design.user_prompt,
        input_image_url=design.input_image_url,
        status=design.status,
        created_by=created_by_name,
    )


    from app.repositories.brand_setting import BrandSettingRepository
    from app.models.subscription import UserSubscription, SubscriptionPlan, SubscriptionStatus
    from app.repositories.order import OrderRepository
    from app.models.manufacturer import Manufacturer
    from app.models.order import ManufacturerQuote
    from sqlalchemy import or_
    from datetime import datetime, timezone
    
    brand_setting = BrandSettingRepository(db).get_by_user_id(design.user_id)
    
    # Check if user has all 3 branding feature flags enabled
    powered_by = False
    now = datetime.now(timezone.utc)
    active_sub = db.query(UserSubscription).join(SubscriptionPlan).filter(
        UserSubscription.user_id == design.user_id,
        UserSubscription.is_queued == False,
        or_(
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            UserSubscription.status == SubscriptionStatus.TRIAL,
            (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
        )
    ).order_by(UserSubscription.end_date.desc()).first()
    
    if active_sub and active_sub.plan:
        plan = active_sub.plan
        # powered_by is true only if ALL 3 flags are true
        if plan.can_use_logo and plan.can_use_brand_name and plan.can_use_custom_color:
            powered_by = True

    # Get approved manufacturer name and delivery time if exists
    approved_manufacturer = None
    order_repo = OrderRepository(db)
    latest_order = order_repo.get_latest_by_design_id(design.id)
    if latest_order and latest_order.current_manufacturer_id:
        # Get the approved quote for delivery time
        approved_quote = db.query(ManufacturerQuote).filter(
            ManufacturerQuote.order_id == latest_order.id,
            ManufacturerQuote.manufacturer_id == latest_order.current_manufacturer_id,
            ManufacturerQuote.status == "APPROVED"
        ).first()
        
        manufacturer = db.query(Manufacturer).filter(Manufacturer.id == latest_order.current_manufacturer_id).first()
        if manufacturer:
            from app.schemas.public import PublicManufacturerAccessResponse
            approved_manufacturer = PublicManufacturerAccessResponse(
                name=manufacturer.name,
                delivery_time_days=approved_quote.delivery_time_days if approved_quote else None,
            )

    return PublicDesignFullResponse(
        design=design_response,
        variants=variant_responses,
        share_status=share.status,
        share_comment=share.comment,
        public_token=share.public_token,
        brand_logo_url=brand_setting.logo_url if brand_setting else None,
        brand_primary_color=brand_setting.primary_color if brand_setting else "#6366F1",
        powered_by=powered_by,
        approved_manufacturer=approved_manufacturer,
    )
