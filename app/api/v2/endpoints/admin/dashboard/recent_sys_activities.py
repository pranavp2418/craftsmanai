from math import ceil
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, cast, String, desc, or_, and_, union
from sqlalchemy.orm import selectinload
from app.api import deps
from app.models.user import User
from app.models.customer import Customer
from app.models.manufacturer import Manufacturer
from app.models.design import Design, DesignActivityLog, DesignShare, DesignVariant, DesignVariantManufacturerShare
from typing import Optional, Dict, Any, List

router = APIRouter()

# Action types originating from customers/manufacturers
CUSTOMER_ACTION_TYPES = {
    "CUSTOMER_APPROVED", "CUSTOMER_REJECTED", "NEEDS_REFINEMENT", "DESIGN_SHARED"
}
MANUFACTURER_ACTION_TYPES = {
    "MANUFACTURER_QUOTE_SUBMITTED",
    "VARIANT_SHARED_WITH_MANUFACTURER",
    "MANUFACTURER_APPROVED",
    "MANUFACTURER_REJECTED",
    "QUOTE_RECEIVED",
    "QUOTE_STATUS_CHANGED",
}


@router.get("/", response_model=Dict[str, Any])
async def get_activity_logs(
    db: AsyncSession = Depends(deps.get_db),
    actor_type: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),  # Filters by SKU or Reference ID
    page: int = 1,
    limit: int = 10,
    admin: User = Depends(deps.get_current_admin)
):
    skip = (page - 1) * limit

    # --------------------------------------------------
    # Build filters for DesignActivityLog query
    # --------------------------------------------------
    filters = []
    
    if actor_type and actor_type.lower() not in ["all", "all actor types"]:
        actor_type_upper = actor_type.upper()
        if actor_type_upper == "ADMIN":
            filters.append(User.is_superuser == True)
        elif actor_type_upper == "RETAILER":
            filters.append(User.is_superuser == False)
        elif actor_type_upper == "CUSTOMER":
            # Customer actions: action_type in customer set, user_id = None
            filters.append(
                DesignActivityLog.action_type.in_(CUSTOMER_ACTION_TYPES)
            )
        elif actor_type_upper == "MANUFACTURER":
            # Manufacturer actions: action_type in manufacturer set
            filters.append(
                DesignActivityLog.action_type.in_(MANUFACTURER_ACTION_TYPES)
            )
        elif actor_type_upper == "SYSTEM":
            filters.append(DesignActivityLog.user_id == None)
            # Exclude customer/manufacturer actions from "system"
            filters.append(
                DesignActivityLog.action_type.notin_(
                    CUSTOMER_ACTION_TYPES | MANUFACTURER_ACTION_TYPES
                )
            )

    if actor_id:
        try:
            actor_int_id = int(actor_id)
            filters.append(DesignActivityLog.user_id == actor_int_id)
        except ValueError:
            filters.append(cast(DesignActivityLog.id, String).ilike(f"{actor_id}"))

    # Base query for data
    query = select(DesignActivityLog).outerjoin(
        Design, DesignActivityLog.design_id == Design.id
    ).outerjoin(
        User, DesignActivityLog.user_id == User.id
    ).where(*filters)

    # Search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Design.design_code.ilike(search_term),
                DesignActivityLog.action_type.ilike(search_term),
                DesignActivityLog.message.ilike(search_term)
            )
        )
    
    # Sorting logic - Default to recently added
    query = query.order_by(desc(DesignActivityLog.created_at))

    # --------------------------------------------------
    # Count query
    # --------------------------------------------------
    count_query = select(func.count(DesignActivityLog.id)).outerjoin(
        Design, DesignActivityLog.design_id == Design.id
    ).outerjoin(
        User, DesignActivityLog.user_id == User.id
    ).where(*filters)

    if search:
        search_term = f"%{search}%"
        count_query = count_query.where(
            or_(
                Design.design_code.ilike(search_term),
                DesignActivityLog.action_type.ilike(search_term),
                DesignActivityLog.message.ilike(search_term)
            )
        )

    count_result = await db.execute(count_query)
    total_items = count_result.scalar() or 0
    
    # Execute paginated data query with selectinloads to fetch relationships
    query = query.options(
        selectinload(DesignActivityLog.design),
        selectinload(DesignActivityLog.user)
    )
    result = await db.execute(query.offset(skip).limit(limit))
    logs = result.scalars().all()

    # --------------------------------------------------
    # Resolve actors from metadata for customer/manufacturer actions
    # --------------------------------------------------
    resolved_logs = []
    for log in logs:
        # Resolve actor name & type
        if log.user:
            actor_name = log.user.full_name or log.user.email
            actor_type_val = "Admin" if log.user.is_superuser else "Retailer"
        elif log.action_type in CUSTOMER_ACTION_TYPES:
            # Customer action - try to extract from metadata
            meta = log.metadata_json or {}
            customer_id = meta.get("customer_id")
            actor_name = "Customer"
            if customer_id:
                # Try to get customer name from DB
                customer_result = await db.execute(
                    select(Customer.full_name).where(Customer.id == customer_id)
                )
                customer_row = customer_result.scalar()
                if customer_row:
                    actor_name = customer_row
            actor_type_val = "Customer"
        elif log.action_type in MANUFACTURER_ACTION_TYPES:
            # Manufacturer action - try to extract from metadata
            meta = log.metadata_json or {}
            manufacturer_id = meta.get("manufacturer_id")
            actor_name = "Manufacturer"
            if manufacturer_id:
                manufacturer_result = await db.execute(
                    select(Manufacturer.name).where(Manufacturer.id == manufacturer_id)
                )
                manufacturer_row = manufacturer_result.scalar()
                if manufacturer_row:
                    actor_name = manufacturer_row
            actor_type_val = "Manufacturer"
        else:
            actor_name = "System"
            actor_type_val = "System"
        
        resolved_logs.append({
            "id": log.id,
            "actor_type": actor_type_val,
            "actor_name": actor_name,
            "action": log.action_type,
            "reference_id": log.design.design_code if log.design else str(log.design_id),
            "timestamp": log.created_at
        })

    total_pages = ceil(total_items / limit) if limit else 1

    return {
        "status": "success",
        "data": resolved_logs,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total_items,
            "total_pages": total_pages
        }
    }
