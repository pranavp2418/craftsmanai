import ast
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.manufacturer import Manufacturer
from app.models.user import User
from app.models.email_log import EmailLog, EmailStatus
from app.repositories.design_share import DesignShareRepository
from app.schemas.manufacturer_variant_share import (
    ManufacturerVariantShareRequest,
    ManufacturerVariantShareResponse,
)
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.services.manufacturer_variant_share_service import DesignVariantManufacturerShareService
from app.models.design import DesignShareStatus


router = APIRouter()
logger = logging.getLogger(__name__)


def _extract_manufacturer_email(manufacturer: Manufacturer) -> Optional[str]:
    raw_emails = manufacturer.emails
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


@router.post(
    "/variants/{variant_id}/share-with-manufacturer",
    response_model=list[ManufacturerVariantShareResponse],
    status_code=status.HTTP_201_CREATED,
)
    
def share_variant_with_manufacturer(
    variant_id: int,
    payload: ManufacturerVariantShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Share a design variant with multiple manufacturers for quoting.

    Creates share links that the manufacturers can use to view the variant
    and submit quotes. The returned list contains details for each share,
    including the ``public_token`` for each manufacturer.

    This endpoint requires the variant to be first shared with a customer.
    The manufacturers will automatically see the same metal that was shared
    with the customer.
    """  
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)
    share_service = DesignVariantManufacturerShareService(db)
    share_repo = DesignShareRepository(db)

    variant = variant_service.get_variant(variant_id)
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    design = design_service.get_design_for_team_member(design_id=variant.design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    # Verify manufacturer IDs
    if not payload.manufacturer_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one manufacturer ID must be provided."
        )

    # ── Check if variant was shared with a customer first ──────────────
    customer_shares = share_repo.list_for_design_variant(variant.id)
    if not customer_shares:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Design is not shared or approved by customer"
            # detail="Design variant must be shared with a customer before sharing with a manufacturer. "
                #    "Please share this variant with a customer first via POST /variants/{variant_id}/share",
        )

    # Use the metal from the customer share (latest one), or None if not set
    latest_customer_share = customer_shares[0]

    if latest_customer_share.status != DesignShareStatus.ACCEPTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Design is not shared or approved by customer"
        )

    shared_metal = latest_customer_share.shared_metal

    if not payload.manufacturer_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one manufacturer ID must be provided."
        )

    shares = []
    from app.repositories.manufacturer import ManufacturerRepository
    from app.tasks.email_tasks import send_manufacturer_share_email, send_manufacturer_share_sms
    from app.core.config import settings

    manufacturer_repo = ManufacturerRepository(db)

    # Validate all manufacturers before creating shares
    for m_id in payload.manufacturer_ids:
        manufacturer = manufacturer_repo.get_by_id(m_id)
        if not manufacturer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Manufacturer {m_id} not found"
            )
        if not manufacturer.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid manufacturer"
            )

    for m_id in payload.manufacturer_ids:
        share = share_service.create_share(
            design_variant_id=variant.id,
            manufacturer_id=m_id,
            shared_metal=shared_metal,
        )
        
        # Build review URL using share service logic
        review_url = share_service.build_review_url(share)
        manufacturer = manufacturer_repo.get_by_id(m_id)

        # Queue an email/SMS to the manufacturer with the preview link
        if manufacturer:
            # Manufacturer emails may be stored as a string or json in `emails`
            primary_email = None
            if hasattr(manufacturer, 'emails') and manufacturer.emails:
                import json
                try:
                    emails_data = json.loads(manufacturer.emails)
                    if isinstance(emails_data, list) and len(emails_data) > 0:
                        primary_email = emails_data[0].get("email") if isinstance(emails_data[0], dict) else emails_data[0]
                    elif isinstance(emails_data, dict):
                        primary_email = emails_data.get("email")
                    else:
                        primary_email = str(emails_data)
                except (json.JSONDecodeError, TypeError, AttributeError):
                    primary_email = str(manufacturer.emails).split(',')[0].strip()
            
            if primary_email:
                # Get brand settings for retailer info
                from app.repositories.brand_setting import BrandSettingRepository
                brand_repo = BrandSettingRepository(db)
                brand_setting = brand_repo.get_by_user_id(current_user.id)
                
                retailer_name = brand_setting.brand_name if brand_setting else (current_user.full_name or current_user.username)
                render_image_url = variant.base_design_image_url or ""
                jewelry_type = design.jewellery_type or "Custom Jewelry"
                metal = shared_metal or "Not specified"
                
                send_manufacturer_share_email.delay(
                    to_email=primary_email,
                    manufacturer_name=manufacturer.name,
                    preview_url=review_url,
                    designer_name=current_user.full_name or current_user.username,
                    retailer_name=retailer_name,
                    render_image_url=render_image_url,
                    design_code=design.design_code,
                    jewelry_type=jewelry_type,
                    metal=metal
                )
                
            if hasattr(manufacturer, 'phone_number') and manufacturer.phone_number:
                # Get brand settings for retailer contact info
                from app.repositories.brand_setting import BrandSettingRepository
                brand_repo = BrandSettingRepository(db)
                brand_setting = brand_repo.get_by_user_id(current_user.id)
                
                retailer_name = brand_setting.brand_name if brand_setting else (current_user.full_name or current_user.username)
                retailer_phone = brand_setting.phone_number if brand_setting else current_user.whatsapp_number
                retailer_email = brand_setting.business_email if brand_setting else current_user.email
                retailer_address = ""  # Address not currently stored in brand settings
                
                send_manufacturer_share_sms.delay(
                    to_number=manufacturer.phone_number,
                    manufacturer_name=manufacturer.name,
                    preview_url=review_url,
                    designer_name=current_user.full_name or current_user.username,
                    retailer_name=retailer_name,
                    design_code=design.design_code,
                    retailer_phone=retailer_phone or "",
                    retailer_email=retailer_email or "",
                    retailer_address=retailer_address
                )

        shares_response.append({
            "id": share.id,
            "design_variant_id": share.design_variant_id,
            "manufacturer_id": share.manufacturer_id,
            "public_token": share.public_token,
            "review_url": review_url,
            "status": share.status.value,
            "cost_price": share.cost_price,
            "delivery_time_days": share.delivery_time_days,
            "notes": share.notes,
            "shared_metal": share.shared_metal,
            "created_at": share.created_at,
        })

    return shares_response
