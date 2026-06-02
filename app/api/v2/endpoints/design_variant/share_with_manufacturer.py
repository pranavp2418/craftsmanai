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
    """
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)
    share_service = DesignVariantManufacturerShareService(db)

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

    share = share_service.create_share(
        design_variant_id=variant.id,
        manufacturer_id=payload.manufacturer_id,
    )

    review_url = share_service.build_review_url(share)
    email_log_id = None
    
    # Send email to manufacturer if they have an email configured
    try:
        recipient_email = _extract_manufacturer_email(manufacturer)
        if recipient_email:
            # Create email log
            subject = f"Review your Craftmen design: {design.name}"
            email_log = EmailLog(
                to_email=recipient_email,
                template_name="design_review",
                subject=subject,
                template_variables=json.dumps({
                    "customer_name": manufacturer.name,
                    "review_url": review_url,
                    "design_name": design.name,
                    "variant_name": variant.variant_name,
                }),
                status=EmailStatus.PENDING,
                retry_count=0,
            )
            db.add(email_log)
            db.commit()
            db.refresh(email_log)
            email_log_id = str(email_log.id)
            
            send_design_review_email.delay(
                recipient_email,
                manufacturer.name,
                review_url,
                design.name,
                variant.variant_name,
                email_log_id,
            )
    except Exception as exc:
        logger.warning(
            "Failed to queue design review email for manufacturer share %s: %s",
            share.id,
            exc,
        )

    if review_url:
        logger.info(
            "Created manufacturer share %s for variant %s and manufacturer %s: %s",
            share.id,
            share.design_variant_id,
            share.manufacturer_id,
            review_url,
        )

    return {
        "id": share.id,
        "design_variant_id": share.design_variant_id,
        "manufacturer_id": share.manufacturer_id,
        "public_token": share.public_token,
        "review_url": review_url,
        "status": share.status.value if hasattr(share.status, "value") else share.status,
        "cost_price": share.cost_price,
        "delivery_time_days": share.delivery_time_days,
        "notes": share.notes,
        "created_at": share.created_at,
    }