from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.manufacturer_variant_share import VariantManufacturerSharesResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.services.manufacturer_variant_share_service import DesignVariantManufacturerShareService
from app.models.order import ManufacturerQuoteStatus


router = APIRouter()


@router.get("/variants/{variant_id}/manufacturer-shares", response_model=VariantManufacturerSharesResponse)
def get_variant_manufacturer_shares(
    variant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return all manufacturer shares for a design variant.

    The response includes the parent design details, the current design status,
    and each shared manufacturer entry from ``design_variant_manufacturer_shares``.
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

    # Get shares for the variant
    shares = share_service.list_for_variant(variant.id)
    
    if not shares:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Design not shared to manufacturer yet",
        )

    from app.repositories.manufacturer import ManufacturerRepository
    manufacturer_repo = ManufacturerRepository(db)
    
    share_items = []
    for share in shares:
        manufacturer = manufacturer_repo.get_by_id(share.manufacturer_id)
        if not manufacturer:
            continue

        quote = share_service.get_quote_for_share(share)
            
        shared_date = share.created_at
        estimated_delivery_date = (
            shared_date + timedelta(days=(quote.delivery_time_days if quote and quote.delivery_time_days is not None else share.delivery_time_days))
            if shared_date and ((quote.delivery_time_days if quote else share.delivery_time_days) is not None)
            else None
        )
        share_items.append(
            {
                "id": share.id,
                "design_variant_id": share.design_variant_id,
                "manufacturer_id": manufacturer.id,
                "manufacturer": manufacturer,
                "shared_date": shared_date,
                "quote_id": quote.id if quote else None,
                "quoted_price": quote.cost_price if quote else share.cost_price,
                "estimated_delivery_days": quote.delivery_time_days if quote else share.delivery_time_days,
                "estimated_delivery_date": estimated_delivery_date,
                "manufacturer_notes": quote.notes if quote else share.notes,
                "status": (
                    quote.status.value
                    if quote and isinstance(quote.status, ManufacturerQuoteStatus)
                    else (share.status.value if hasattr(share.status, "value") else share.status)
                ),
                "public_token": share.public_token,
                "shared_metal": share.shared_metal,
                "shared_angles": share.shared_angles,
            }
        )

    return VariantManufacturerSharesResponse(
        variant_id=variant.id,
        variant_name=variant.variant_name,
        version_number=variant.version_number,
        design_id=design.id,
        design_code=design.design_code,
        design_name=design.name,
        design_variant_status=design.status,
        design_status=design.status,
        total_shares=len(share_items),
        shares=share_items,
    )
