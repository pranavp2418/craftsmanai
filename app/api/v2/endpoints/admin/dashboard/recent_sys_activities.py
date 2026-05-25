from math import ceil
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, cast, String, desc, or_
from sqlalchemy.orm import selectinload
from app.api import deps
from app.models.user import User
from app.models.design import Design, DesignActivityLog
from typing import Optional, Dict, Any

router = APIRouter()

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

    # Base query for data
    query = select(DesignActivityLog).outerjoin(
        Design, DesignActivityLog.design_id == Design.id
    ).outerjoin(
        User, DesignActivityLog.user_id == User.id
    )

    # Dynamic Filters
    if actor_type and actor_type.lower() not in ["all", "all actor types"]:
        if actor_type.upper() == "ADMIN":
            query = query.where(User.is_superuser == True)
        elif actor_type.upper() == "RETAILER":
            query = query.where(User.is_superuser == False)
        elif actor_type.upper() == "SYSTEM":
            query = query.where(DesignActivityLog.user_id == None)
        
    if actor_id:
        try:
            actor_int_id = int(actor_id)
            query = query.where(
                or_(
                    DesignActivityLog.user_id == actor_int_id,
                    cast(DesignActivityLog.id, String).ilike(f"{actor_id}")
                )
            )
        except ValueError:
            query = query.where(cast(DesignActivityLog.id, String).ilike(f"{actor_id}"))
        
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

    # Optimized count query
    count_query = select(func.count(DesignActivityLog.id)).outerjoin(
        Design, DesignActivityLog.design_id == Design.id
    ).outerjoin(
        User, DesignActivityLog.user_id == User.id
    )
    
    if actor_type and actor_type.lower() not in ["all", "all actor types"]:
        if actor_type.upper() == "ADMIN":
            count_query = count_query.where(User.is_superuser == True)
        elif actor_type.upper() == "RETAILER":
            count_query = count_query.where(User.is_superuser == False)
        elif actor_type.upper() == "SYSTEM":
            count_query = count_query.where(DesignActivityLog.user_id == None)
        
    if actor_id:
        try:
            actor_int_id = int(actor_id)
            count_query = count_query.where(
                or_(
                    DesignActivityLog.user_id == actor_int_id,
                    cast(DesignActivityLog.id, String).ilike(f"{actor_id}")
                )
            )
        except ValueError:
            count_query = count_query.where(cast(DesignActivityLog.id, String).ilike(f"{actor_id}"))
        
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

    # Prepare resolved logs
    resolved_logs = []
    for log in logs:
        # Resolve actor name & type
        if log.user:
            actor_name = log.user.full_name or log.user.email
            actor_type_val = "Admin" if log.user.is_superuser else "Retailer"
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
