from math import ceil
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.design import DesignStatus
from app.models.user import User
from app.schemas.design import (
    DesignListResponse,
    DesignResponse,
    DesignVariantListItem,
    SharedCustomerInfo,
)
from app.schemas.design_variant import PaginationMetadata
from app.services.design_service import DesignService


router = APIRouter()


def _build_design_response(design) -> dict:
    """Build a DesignResponse-compatible dict from a Design model with transient data."""
    # Get base design fields
    variants = []
    for v in getattr(design, "_variants", []):
        variants.append(DesignVariantListItem(
            id=v.id,
            design_id=v.design_id,
            parent_variant_id=v.parent_variant_id,
            variant_name=v.variant_name,
            version_number=v.version_number,
            base_design_image_url=v.base_design_image_url,
            angles_json=v.angles_json,
            metal_variations_json=v.metal_variations_json,
            prompt_used=v.prompt_used,
            model_used=v.model_used,
            is_selected=v.is_selected,
            is_archived=v.is_archived,
            design_focus=v.design_focus,
            style_tags=v.style_tags,
            reference_images_json=v.reference_images_json,
            created_at=v.created_at,
        ))

    shared_customer = None
    sc = getattr(design, "_shared_customer", None)
    if sc:
        shared_customer = SharedCustomerInfo(
            customer_name=sc["customer_name"],
            public_token=sc["public_token"],
            share_status=sc["share_status"],
            share_comment=sc.get("share_comment"),
        )

    return {
        "id": design.id,
        "user_id": design.user_id,
        "created_by_user_id": design.created_by_user_id,
        "design_code": design.design_code,
        "sequence_number": design.sequence_number,
        "name": design.name,
        "jewellery_type": design.jewellery_type,
        "user_prompt": design.user_prompt,
        "input_image_url": design.input_image_url,
        "input_image_urls": design.input_image_urls,
        "status": design.status,
        "created_at": design.created_at,
        "updated_at": design.updated_at,
        "base_image_url": getattr(design, "base_image_url", None),
        "variants": variants,
        "shared_customer": shared_customer,
    }


@router.get("/", response_model=DesignListResponse)
def list_designs(
    status: DesignStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=100, description="Number of records per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = DesignService(db)
    offset = (page - 1) * limit
    items, total = service.list_designs(
        user=current_user,
        status=status,
        search=search,
        limit=limit,
        offset=offset,
    )
    items = [design for design in items if not getattr(design, "is_archived", False)]
    response_items = [DesignResponse.model_validate(_build_design_response(d)) for d in items]

    total_pages = ceil(total / limit) if limit > 0 else 1

    pagination = PaginationMetadata(
        page=page,
        limit=limit,
        total_items=total,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )

    return DesignListResponse(items=response_items, total=total, pagination=pagination)