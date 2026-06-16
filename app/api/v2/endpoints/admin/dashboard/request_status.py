from math import ceil
from typing import Any, Optional, Dict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, cast, String
from sqlalchemy.orm import aliased

from app.api import deps
from app.models.user import User
from app.models.customer import Customer
from app.models.design import Design, DesignStatus, DesignVariant, DesignShare

router = APIRouter()

# --------------------------------------------------
#  UI STATUS → ENUM MAPPING
# --------------------------------------------------
UI_STATUS_MAP = {
    "DETECTED": [
        DesignStatus.GENERATING,
    ],
    "QUOTE_REQUESTED": [
        DesignStatus.UNDER_REVIEW,
        DesignStatus.QUOTES_REQUESTED,
    ],
    "QUOTE_RECEIVED": [
        DesignStatus.QUOTE_RECEIVED,
    ],
    "IN_PROGRESS": [
        DesignStatus.DRAFT,
        DesignStatus.GENERATED,
        DesignStatus.SHARED,
        DesignStatus.REFINEMENT_REQUESTED,
    ],
    "APPROVED": [
        DesignStatus.APPROVED,
    ],
    "DESIGN_REJECTED": [
        DesignStatus.DESIGN_REJECTED,
    ],
    "MANUFACTURER_APPROVED": [
        DesignStatus.MANUFACTURER_APPROVED,
    ],
    "IN_PRODUCTION": [
        DesignStatus.IN_PRODUCTION,
    ],
    "COMPLETED": [
        DesignStatus.COMPLETED,
    ],
    "SENT_TO_MANUFACTURER": [
        DesignStatus.SENT_TO_MANUFACTURER,
    ],
    "FAILED": [
        DesignStatus.REJECTED,
    ],
}


# --------------------------------------------------
#  MAIN API
# --------------------------------------------------
@router.get("/details", response_model=Dict[str, Any])
async def get_monitoring_requests(
    db: AsyncSession = Depends(deps.get_db),
    status: Optional[str] = Query(None),
    retailer_id: Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    page: int = 1,
    limit: int = 10,
    admin: User = Depends(deps.get_current_admin),
):
    skip = (page - 1) * limit

    # --------------------------------------------------
    #  ALIASES FOR JOIN (PERFORMANCE)
    # --------------------------------------------------
    CustomerAlias = aliased(Customer)
    RetailerAlias = aliased(User)

    # --------------------------------------------------
    #  BUILD FILTERS
    # --------------------------------------------------
    filters = []

    # Status Filter
    if status and status.upper() not in ["ALL", "ALL STATUS"]:
        status_upper = status.upper().replace(" ", "_")
        mapped_statuses = UI_STATUS_MAP.get(status_upper)
        if mapped_statuses:
            filters.append(Design.status.in_(mapped_statuses))
        else:
            filters.append(cast(Design.status, String).ilike(f"%{status}%"))

    # Retailer Filter
    if retailer_id:
        filters.append(Design.user_id == retailer_id)

    # Customer Filter
    if customer_id:
        filters.append(DesignShare.customer_id == customer_id)

    # Global Search Filter
    if search:
        search_term = f"%{search}%"
        filters.append(
            or_(
                Design.design_code.ilike(search_term),
                Design.name.ilike(search_term),
                Design.user_prompt.ilike(search_term),
                Design.jewellery_type.ilike(search_term),
                cast(Design.status, String).ilike(search_term),
                cast(Design.id, String).ilike(search_term),
                cast(Design.user_id, String).ilike(search_term),
                CustomerAlias.full_name.ilike(search_term),
                CustomerAlias.emails.ilike(search_term),
                CustomerAlias.phone_number.ilike(search_term),
                CustomerAlias.tag.ilike(search_term),
                CustomerAlias.location.ilike(search_term),
                RetailerAlias.full_name.ilike(search_term),
                RetailerAlias.email.ilike(search_term),
                RetailerAlias.username.ilike(search_term),
                RetailerAlias.whatsapp_number.ilike(search_term),
                RetailerAlias.business_name.ilike(search_term),
            )
        )

    # --------------------------------------------------
    #  BASE QUERY
    # --------------------------------------------------
    base_query = (
        select(
            Design.id,
            Design.design_code,
            Design.name,
            Design.jewellery_type,
            Design.status,
            Design.created_at,
            Design.updated_at,
            func.max(CustomerAlias.full_name).label("customer_name"),
            func.max(RetailerAlias.full_name).label("retailer_name"),
            func.max(RetailerAlias.email).label("retailer_email"),
        )
        .outerjoin(DesignVariant, Design.id == DesignVariant.design_id)
        .outerjoin(DesignShare, DesignVariant.id == DesignShare.design_variant_id)
        .outerjoin(CustomerAlias, DesignShare.customer_id == CustomerAlias.id)
        .outerjoin(RetailerAlias, Design.user_id == RetailerAlias.id)
        .where(*filters)
        .group_by(
            Design.id,
            Design.design_code,
            Design.name,
            Design.jewellery_type,
            Design.status,
            Design.created_at,
            Design.updated_at
        )
    )

    # --------------------------------------------------
    # COUNT QUERY
    # --------------------------------------------------
    count_query = (
        select(func.count(func.distinct(Design.id)))
        .outerjoin(DesignVariant, Design.id == DesignVariant.design_id)
        .outerjoin(DesignShare, DesignVariant.id == DesignShare.design_variant_id)
        .outerjoin(CustomerAlias, DesignShare.customer_id == CustomerAlias.id)
        .outerjoin(RetailerAlias, Design.user_id == RetailerAlias.id)
        .where(*filters)
    )
    total_result = await db.execute(count_query)
    total_items = total_result.scalar() or 0

    # --------------------------------------------------
    #  DATA QUERY (PAGINATED)
    # --------------------------------------------------
    data_query = (
        base_query.order_by(Design.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(data_query)
    rows = result.all()

    total_pages = ceil(total_items / limit) if limit else 1

    # --------------------------------------------------
    #  RESPONSE FORMAT
    # --------------------------------------------------
    data = []
    for row in rows:
        status_val = row.status.value if hasattr(row.status, "value") else str(row.status)
        created_at_date = row.created_at.date() if row.created_at else None

        data.append({
            "request_id": row.id,
            "reference_id": row.design_code,
            "title": row.name,
            "jewellery_type": row.jewellery_type,
            "jewellery_subtype": None,
            "current_status": status_val,
            "retailer": row.retailer_name or row.retailer_email or "System",
            "customer": row.customer_name or "N/A",
            "created_at": created_at_date,
            "last_updated": row.updated_at,
        })

    return {
        "status": "success",
        "data": data,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages,
        },
    }