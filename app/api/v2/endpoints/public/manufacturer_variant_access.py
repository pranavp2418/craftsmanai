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

    # Filter angles by share.shared_angles if specified
    if share.shared_angles and isinstance(filtered_angles, dict):
        shared_angles_set = {a.lower() for a in share.shared_angles}
        new_filtered_angles = {}
        for metal_key, angles_dict in filtered_angles.items():
            if isinstance(angles_dict, dict):
                new_angles_dict = {
                    angle_key: angle_val
                    for angle_key, angle_val in angles_dict.items()
                    if angle_key.lower() in shared_angles_set
                }
                new_filtered_angles[metal_key] = new_angles_dict
            else:
                new_filtered_angles[metal_key] = angles_dict
        filtered_angles = new_filtered_angles

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

    # Fetch production sheet details using the design variant id
    from app.models.production_sheet import ProductionSheet
    production_sheet = db.query(ProductionSheet).filter(ProductionSheet.variant_id == variant.id).first()

    from app.repositories.brand_setting import BrandSettingRepository
    from app.models.subscription import UserSubscription, SubscriptionPlan, SubscriptionStatus
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

    return PublicDesignFullResponse(
        design=design_response,
        variants=variant_responses,
        share_status=share.status,  # Manufacturer share uses its own status
        share_comment=share.notes,
        public_token=share.public_token,
        production_sheet=production_sheet,
        brand_logo_url=brand_setting.logo_url if brand_setting else None,
        brand_primary_color=brand_setting.primary_color if brand_setting else "#6366F1",
        powered_by=powered_by,
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

    try:
        updated = share_service.submit_quote(
            share,
            cost_price=payload.cost_price,
            delivery_time_days=payload.delivery_time_days,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    quote = share_service.get_quote_for_share(updated)

    # Load related objects for notification
    variant = share.design_variant
    design = variant.design if variant else None
    manufacturer = share.manufacturer

    # Send email notification to the design owner (retailer)
    if design:
        try:
            from app.models.user import User
            from app.repositories.brand_setting import BrandSettingRepository
            from app.models.subscription import UserSubscription, SubscriptionStatus
            from app.tasks.email_tasks import send_quote_submitted_email
            from app.services.notification_service import NotificationService
            from app.core.config import settings

            # Get the design owner
            design_owner = db.query(User).filter(User.id == design.user_id).first()
            if design_owner and design_owner.email:
                # Get brand settings
                brand_repo = BrandSettingRepository(db)
                brand_setting = brand_repo.get_by_user_id(design_owner.id)

                # Check subscription plan feature flags
                active_subscription = db.query(UserSubscription).filter(
                    UserSubscription.user_id == design_owner.id,
                    UserSubscription.status == SubscriptionStatus.ACTIVE
                ).first()

                # Determine brand logo and color based on subscription plan
                brand_logo_url = None
                brand_primary_color = "#6366F1"  # Default color

                if active_subscription and active_subscription.plan:
                    if active_subscription.plan.can_use_logo:
                        if brand_setting and brand_setting.logo_url:
                            brand_logo_url = brand_setting.logo_url
                    if active_subscription.plan.can_use_custom_color:
                        if brand_setting and brand_setting.primary_color:
                            brand_primary_color = brand_setting.primary_color

                # Determine retailer name
                retailer_name = (
                    brand_setting.brand_name if brand_setting and brand_setting.brand_name
                    else design_owner.business_name
                    or design_owner.full_name
                    or design_owner.username
                )

                # Send email to design owner
                send_quote_submitted_email.delay(
                    to_email=design_owner.email,
                    retailer_name=retailer_name,
                    manufacturer_name=manufacturer.name if manufacturer else "Manufacturer",
                    design_number=design.design_code,
                    estimated_cost=str(quote.cost_price) if quote else str(updated.cost_price),
                    production_timeline=f"{quote.delivery_time_days} days" if quote else f"{updated.delivery_time_days} days",
                    quote_url=f"{settings.FRONTEND_URL}/designs/{design.id}",
                    render_image_url=variant.base_design_image_url or "",
                    brand_logo_url=brand_logo_url,
                    brand_primary_color=brand_primary_color
                )

                # Send in-app notification
                try:
                    notification_service = NotificationService(db)
                    notification_service.send_notification(
                        user_id=design_owner.id,
                        type="quote_received",
                        title="Quote Received",
                        message=f"Manufacturer {manufacturer.name if manufacturer else 'Unknown'} has submitted a quote for design {design.design_code}. Estimated cost: {quote.cost_price if quote else updated.cost_price}, Timeline: {quote.delivery_time_days if quote else updated.delivery_time_days} days.",
                        source="manufacturer_quote",
                        reference_id=quote.id if quote else updated.id,
                        data={
                            "share_id": share.id,
                            "design_id": design.id,
                            "variant_id": variant.id,
                            "manufacturer_id": manufacturer.id if manufacturer else None,
                            "quote_id": quote.id if quote else None,
                        }
                    )
                except Exception as notif_exc:
                    import logging
                    logging.getLogger(__name__).error(f"Failed to send quote notification: {str(notif_exc)}")

        except Exception as email_exc:
            import logging
            logging.getLogger(__name__).error(f"Failed to send quote submitted email: {str(email_exc)}")

    return {
        "success": True,
        "message": "Quote submitted successfully",
        "quote_id": quote.id if quote else None,
        "share_id": updated.id,
        "design_variant_id": updated.design_variant_id,
        "manufacturer_id": updated.manufacturer_id,
        "status": updated.status.value,
        "cost_price": quote.cost_price if quote else updated.cost_price,
        "delivery_time_days": quote.delivery_time_days if quote else updated.delivery_time_days,
    }
