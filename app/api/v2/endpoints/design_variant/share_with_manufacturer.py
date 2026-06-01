from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.repositories.design_share import DesignShareRepository
from app.schemas.manufacturer_variant_share import (
    ManufacturerVariantShareRequest,
    ManufacturerVariantShareResponse,
)
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.services.manufacturer_variant_share_service import DesignVariantManufacturerShareService


router = APIRouter()


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

    # Queue an email to the manufacturer with the preview link
    # We will get the manufacturer's email from the payload or from DB
    from app.repositories.manufacturer import ManufacturerRepository
    from app.tasks.email_tasks import send_manufacturer_share_email
    from app.core.config import settings

    manufacturer_repo = ManufacturerRepository(db)
    manufacturer = manufacturer_repo.get_by_id(payload.manufacturer_id)
    if manufacturer and manufacturer.email:
        preview_url = f"{settings.FRONTEND_URL}/manufacturer/review/{share.public_token}"
        send_manufacturer_share_email.delay(
            to_email=manufacturer.email,
            manufacturer_name=manufacturer.name,
            preview_url=preview_url,
            designer_name=current_user.full_name or current_user.username
        )

    return share
