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

    # Check if customer exists and is active before sharing
    if payload.customer_id:
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

    # Normalize metal to lowercase for consistent lookup
    metal = payload.metal.lower() if payload.metal else None

    try:
        share = sharing_service.create_share(
            design_variant_id=variant.id,
            customer_id=payload.customer_id,
            comment=payload.comment,
            shared_metal=metal,
        )
    except ValueError as e:
        if str(e) in ["Design is already shared with another customer.", "Design already rejected by customer"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            )
        raise

    # Update the design status to SHARED when shared with a customer
    from app.models.design import DesignStatus
    if design.status != DesignStatus.SHARED:
        design_service.update_design(design, status=DesignStatus.SHARED)

    # Queue email to customer if customer exists and has email/phone
    if payload.customer_id:
        from app.tasks.email_tasks import send_customer_share_email, send_customer_share_sms
        from app.core.config import settings

        customer = customer_repo.get_by_id(payload.customer_id)
        
        preview_url = f"{settings.FRONTEND_URL}/customer/review/{share.public_token}"
        
        if customer and hasattr(customer, 'emails') and customer.emails:
            import json
            try:
                emails_data = json.loads(customer.emails)
                if isinstance(emails_data, list) and len(emails_data) > 0:
                    primary_email = emails_data[0].get("email") if isinstance(emails_data[0], dict) else emails_data[0]
                elif isinstance(emails_data, dict):
                    primary_email = emails_data.get("email")
                else:
                    primary_email = str(emails_data)
            except (json.JSONDecodeError, TypeError, AttributeError):
                # Fallback if it's stored differently
                primary_email = str(customer.emails).split(',')[0].strip()
            
            if primary_email:
                # Get brand settings for retailer name
                from app.repositories.brand_setting import BrandSettingRepository
                brand_repo = BrandSettingRepository(db)
                brand_setting = brand_repo.get_by_user_id(current_user.id)
                
                retailer_name = brand_setting.brand_name if brand_setting else (current_user.full_name or current_user.username)
                render_image_url = variant.base_design_image_url or ""
                jewelry_type = design.jewellery_type or "Custom Jewelry"
                version = f"v{variant.version_number}.{variant.version_number}" if variant.version_number else "v1.0"
                version_label = f"Version {variant.version_number}" if variant.version_number else "Version 1"
                
                # Determine brand logo based on subscription plan
                # Pro plan users get their brand logo; Starter plan users get the default CraftsmanAI logo
                brand_logo_url = None
                if current_user.subscription_plan and current_user.subscription_plan.lower() == "pro":
                    brand_logo_url = brand_setting.logo_url if brand_setting else None
                
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
                    brand_logo_url=brand_logo_url
                )
                
        if customer and hasattr(customer, 'phone_number') and customer.phone_number:
            # Get brand settings for retailer contact info
            from app.repositories.brand_setting import BrandSettingRepository
            brand_repo = BrandSettingRepository(db)
            brand_setting = brand_repo.get_by_user_id(current_user.id)
            
            retailer_phone = brand_setting.phone_number if brand_setting else current_user.whatsapp_number
            retailer_email = brand_setting.business_email if brand_setting else current_user.email
            retailer_address = ""  # Address not currently stored in brand settings
            
            send_customer_share_sms.delay(
                to_number=customer.phone_number,
                customer_name=customer.full_name or "Customer",
                preview_url=preview_url,
                designer_name=current_user.full_name or current_user.username,
                design_code=design.design_code,
                retailer_phone=retailer_phone or "",
                retailer_email=retailer_email or "",
                retailer_address=retailer_address,
                render_image_url=variant.base_design_image_url or ""
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

    # Verify the new variant exists
    new_variant = variant_service.get_variant(payload.design_variant_id)
    if not new_variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="New variant not found")

    # Verify the user owns the design
    design = design_service.get_design_for_team_member(design_id=new_variant.design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    # Find the share by token
    share = sharing_service.get_by_token(share_token)
    if not share:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")

    # Update the variant reference
    updated = sharing_service.update_variant(
        share,
        design_variant_id=payload.design_variant_id,
    )

    return updated
