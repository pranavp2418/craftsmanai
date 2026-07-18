import ast
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.customer import Customer
from app.models.user import User
from app.schemas.design import DesignShareCreateRequest, DesignShareResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.services.design_sharing_service import DesignSharingService
from app.tasks.email_tasks import send_design_review_email


router = APIRouter()
logger = logging.getLogger(__name__)


class UpdateShareVariantRequest(BaseModel):
    """Request to update the variant referenced by a share."""
    design_variant_id: int = Field(..., ge=1, description="ID of the new variant to link")
    comment: Optional[str] = Field(default=None, description="Optional comment about the update")


def _extract_customer_email(customer: Customer) -> Optional[str]:
    raw_emails = customer.emails
    if not raw_emails:
        return None

    if isinstance(raw_emails, list):
        parsed = raw_emails
    else:
        try:
            parsed = json.loads(raw_emails)
        except Exception:
            try:
                parsed = ast.literal_eval(raw_emails)
            except Exception:
                return str(raw_emails)

    if isinstance(parsed, dict):
        parsed = [parsed]

    if not isinstance(parsed, list):
        return str(raw_emails)

    for item in parsed:
        if isinstance(item, dict):
            email = item.get("email")
            if email:
                return str(email)
        elif item:
            return str(item)

    return None


def _send_customer_notifications(
    db: Session,
    current_user: User,
    customer: Customer,
    share,
    variant,
    design,
    preview_url: str,
):
    """Helper to send email and SMS notifications to a customer for a share."""
    from app.tasks.email_tasks import send_customer_share_email, send_customer_share_sms
    from app.core.config import settings
    from app.repositories.brand_setting import BrandSettingRepository
    import json

    brand_repo = BrandSettingRepository(db)
    brand_setting = brand_repo.get_by_user_id(current_user.id)

    # Prepare common variables
    customer_name = customer.full_name or "Customer"
    designer_name = current_user.full_name or current_user.username
    design_code = design.design_code
    
    # Check if user has an active subscription with can_use_custom_color feature
    from app.models.subscription import UserSubscription, SubscriptionStatus
    active_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == current_user.id,
        UserSubscription.status == SubscriptionStatus.ACTIVE
    ).first()
    
    # Only use custom brand color if subscription allows it
    if active_subscription and active_subscription.plan and active_subscription.plan.can_use_custom_color:
        brand_primary_color = brand_setting.primary_color if brand_setting else "#6366F1"
    else:
        brand_primary_color = "#6366F1"  # Default color
    
    # Determine retailer name: brand_name > business_name > full_name > username
    retailer_name = (
        brand_setting.brand_name if brand_setting and brand_setting.brand_name
        else current_user.business_name
        or current_user.full_name
        or current_user.username
    )

    # --- Email ---
    if customer and hasattr(customer, 'emails') and customer.emails:
        try:
            emails_data = json.loads(customer.emails)
            if isinstance(emails_data, list) and len(emails_data) > 0:
                primary_email = emails_data[0].get("email") if isinstance(emails_data[0], dict) else emails_data[0]
            elif isinstance(emails_data, dict):
                primary_email = emails_data.get("email")
            else:
                primary_email = str(emails_data)
        except (json.JSONDecodeError, TypeError, AttributeError):
            primary_email = str(customer.emails).split(',')[0].strip()

        if primary_email:
            retailer_name = brand_setting.brand_name if brand_setting else (current_user.full_name or current_user.username)
            render_image_url = variant.base_design_image_url or ""
            jewelry_type = design.jewellery_type or "Custom Jewelry"
            version = f"v{variant.version_number}.{variant.version_number}" if variant.version_number else "v1.0"
            version_label = f"Version {variant.version_number}" if variant.version_number else "Version 1"

            brand_logo_url = None
            # Check if user has an active subscription with can_use_logo feature AND has a logo set
            from app.models.subscription import UserSubscription, SubscriptionStatus
            active_subscription = db.query(UserSubscription).filter(
                UserSubscription.user_id == current_user.id,
                UserSubscription.status == SubscriptionStatus.ACTIVE
            ).first()
            if active_subscription and active_subscription.plan and active_subscription.plan.can_use_logo:
                if brand_setting and brand_setting.logo_url:
                    brand_logo_url = brand_setting.logo_url

            send_customer_share_email.delay(
                to_email=primary_email,
                customer_name=customer.full_name or "Customer",
                preview_url=preview_url,
                designer_name=current_user.full_name or current_user.username,
                retailer_name=retailer_name,
                render_image_url=render_image_url,
                design_code=design.design_code,
                jewelry_type=jewelry_type,
                version=version,
                version_label=version_label,
                brand_logo_url=brand_logo_url,
                brand_primary_color=brand_primary_color
            )

    # --- SMS ---
    if customer and hasattr(customer, 'phone_number') and customer.phone_number:
        retailer_phone = brand_setting.phone_number if brand_setting else current_user.whatsapp_number
        retailer_email = brand_setting.business_email if brand_setting else current_user.email
        retailer_address = ""

        send_customer_share_sms.delay(
            to_number=customer.phone_number,
            customer_name=customer_name,
            preview_url=preview_url,
            designer_name=designer_name,
            design_code=design_code,
            retailer_phone=retailer_phone or "",
            retailer_email=retailer_email or "",
            retailer_address=retailer_address,
            render_image_url=variant.base_design_image_url or "",
        )


@router.post("/variants/{variant_id}/share", response_model=DesignShareResponse, status_code=status.HTTP_201_CREATED)
def share_design_variant(
    variant_id: int,
    payload: DesignShareCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Share a specific design variant with a customer.

    The share is linked to the variant (not the design), so the customer
    will see only the shared variant's data when they access it.
    """
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)
    sharing_service = DesignSharingService(db)

    variant = variant_service.get_variant(variant_id)
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    design = design_service.get_design_for_team_member(design_id=variant.design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    # --- If no customer_id provided, check for existing share or reject ---
    if not payload.customer_id:
        existing_shares = sharing_service.share_repo.list_for_design_variant(variant.id)
        if not existing_shares:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="customer_id is required",
            )
        # Resend notification to the existing customer
        share = existing_shares[0]
        if share.customer:
            # Security check: verify the existing customer belongs to the current user
            if share.customer.created_by_user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to send notifications to this customer",
                )
            from app.core.config import settings
            preview_url = f"{settings.FRONTEND_URL}/customer/review/{share.public_token}"
            _send_customer_notifications(
                db=db,
                current_user=current_user,
                customer=share.customer,
                share=share,
                variant=variant,
                design=design,
                preview_url=preview_url,
            )
        return share

    # --- customer_id IS provided --- validate the customer ---
    from app.repositories.customer import CustomerRepository
    customer_repo = CustomerRepository(db)
    customer = customer_repo.get_by_id(payload.customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )
    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid customer",
        )
    
    # Security check: verify the customer belongs to the current user
    # Check both direct user_id ownership and team ownership
    if customer.created_by_user_id != current_user.id:
        # For team members, also check if the team owner owns this customer
        if not (current_user.is_team_member and current_user.team_owner_id and customer.created_by_user_id == current_user.team_owner_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to share with this customer",
            )

    # Normalize metal to lowercase for consistent lookup
    metal = payload.metal.lower() if payload.metal else None

    # Check if this variant was already shared with the same customer
    existing_shares = sharing_service.share_repo.list_for_design_variant(variant.id)
    is_resend_to_same_customer = (
        existing_shares
        and existing_shares[0].customer_id == payload.customer_id
    )

    try:
        share = sharing_service.create_share(
            design_variant_id=variant.id,
            customer_id=payload.customer_id,
            comment=payload.comment,
            shared_metal=metal,
            shared_angles=payload.angles,
        )
    except ValueError as e:
        if str(e) in [
            "Design is already shared with another customer.",
            "Design already rejected by customer",
            "This design already has a shared variant.",
            "This variant is already shared with another customer.",
        ]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            )
        raise

    # Only update design status to SHARED if this is a new share (not a resend to same customer)
    from app.models.design import DesignStatus
    if not is_resend_to_same_customer and design.status != DesignStatus.SHARED:
        design_service.update_design(design, status=DesignStatus.SHARED)

    # Queue email/SMS to customer
    from app.core.config import settings
    preview_url = f"{settings.FRONTEND_URL}/customer/review/{share.public_token}"
    _send_customer_notifications(
        db=db,
        current_user=current_user,
        customer=customer,
        share=share,
        variant=variant,
        design=design,
        preview_url=preview_url,
    )

    return share


@router.patch("/shares/{share_token}/variant", response_model=DesignShareResponse)
def update_share_variant(
    share_token: str,
    payload: UpdateShareVariantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update the variant referenced by a share (after refinement/revision).

    After the customer requests changes, the creator refines the variant and
    updates the share to point to the new variant. The share status returns
    to PENDING so the customer can review the updated variant.
    """
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)
    sharing_service = DesignSharingService(db)

    # Find the share by token FIRST
    share = sharing_service.get_by_token(share_token)
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")

    # SECURITY FIX (Share Hijack): Verify the current user owns the share's
    # ORIGINAL design before allowing any update. This prevents an attacker
    # from repointing a share they don't own to their own variant.
    original_variant = variant_service.get_variant(share.design_variant_id)
    if not original_variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Original variant not found")

    original_design = design_service.get_design_for_team_member(
        design_id=original_variant.design_id, user=current_user
    )
    if not original_design:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this share",
        )

    # Verify the new variant exists
    new_variant = variant_service.get_variant(payload.design_variant_id)
    if not new_variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New variant not found")

    # Verify the user owns the new variant's design as well
    new_design = design_service.get_design_for_team_member(
        design_id=new_variant.design_id, user=current_user
    )
    if not new_design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found for new variant")

    # Update the variant reference
    updated = sharing_service.update_variant(
        share,
        design_variant_id=payload.design_variant_id,
    )

    return updated