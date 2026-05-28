from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design import DesignShareCreateRequest, DesignShareResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.services.design_sharing_service import DesignSharingService


router = APIRouter()


class UpdateShareVariantRequest(BaseModel):
    """Request to update the variant referenced by a share."""
    design_variant_id: int = Field(..., ge=1, description="ID of the new variant to link")
    comment: Optional[str] = Field(default=None, description="Optional comment about the update")


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

    share = sharing_service.create_share(
        design_variant_id=variant.id,
        customer_id=payload.customer_id,
        comment=payload.comment,
        require_approval=payload.require_approval,
        allow_feedback=payload.allow_feedback,
        allow_review_request=payload.allow_review_request
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
