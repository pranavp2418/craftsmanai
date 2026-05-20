from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
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
    """
    design_service = DesignService(db)
    variant_service = DesignVariantService(db)
    share_service = DesignVariantManufacturerShareService(db)

    variant = variant_service.get_variant(variant_id)
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    design = design_service.get_design_for_user(design_id=variant.design_id, user_id=current_user.id)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    share = share_service.create_share(
        design_variant_id=variant.id,
        manufacturer_id=payload.manufacturer_id,
    )

    return share