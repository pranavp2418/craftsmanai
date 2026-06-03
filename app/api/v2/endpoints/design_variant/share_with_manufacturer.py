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
from app.tasks.email_tasks import send_design_review_email


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
    response_model=ManufacturerVariantShareResponse,
    status_code=status.HTTP_201_CREATED,
)
def share_variant_with_manufacturer(
    variant_id: int,
    payload: ManufacturerVariantShareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Share a design variant with a manufacturer for quoting.

    Creates a share link that the manufacturer can use to view the variant
    and submit a quote.  The returned ``public_token`` should be sent to the
    manufacturer.

    This endpoint requires the variant to be first shared with a customer.
    The manufacturer will automatically see the same metal that was shared
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

    # Verify manufacturer exists
    manufacturer = db.query(Manufacturer).filter(Manufacturer.id == payload.manufacturer_id).first()
    if not manufacturer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manufacturer not found")
    # ── Check if variant was shared with a customer first ──────────────
    customer_shares = share_repo.list_for_design_variant(variant.id)
    if not customer_shares:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Design variant must be shared with a customer before sharing with a manufacturer. "
                   "Please share this variant with a customer first via POST /variants/{id}/share",
        )

    # Use the metal from the customer share (latest one), or None if not set
    latest_customer_share = customer_shares[0]
    shared_metal = latest_customer_share.shared_metal

    share = share_service.create_share(
        design_variant_id=variant.id,
        manufacturer_id=payload.manufacturer_id,
        shared_metal=shared_metal,
    )

    # Queue an email/SMS to the manufacturer with the preview link
    # We will get the manufacturer's email/phone from the DB
    from app.repositories.manufacturer import ManufacturerRepository
    from app.tasks.email_tasks import send_manufacturer_share_email, send_manufacturer_share_sms
    from app.core.config import settings

    manufacturer_repo = ManufacturerRepository(db)
    manufacturer = manufacturer_repo.get_by_id(payload.manufacturer_id)
    if manufacturer:
        preview_url = f"{settings.FRONTEND_URL}/manufacturer/review/{share.public_token}"
        
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
            send_manufacturer_share_email.delay(
                to_email=primary_email,
                manufacturer_name=manufacturer.name,
                preview_url=preview_url,
                designer_name=current_user.full_name or current_user.username
            )
            
        if hasattr(manufacturer, 'phone_number') and manufacturer.phone_number:
            send_manufacturer_share_sms.delay(
                to_number=manufacturer.phone_number,
                manufacturer_name=manufacturer.name,
                preview_url=preview_url,
                designer_name=current_user.full_name or current_user.username
            )

    return share
