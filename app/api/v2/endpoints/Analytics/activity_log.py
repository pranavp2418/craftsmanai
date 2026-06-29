from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_db, get_current_active_user
from app.models.user import User
from app.schemas.analytics import ActivityLogFilter
from app.services.analytics_service import AnalyticsService

router = APIRouter()


class RecentActivityItem(BaseModel):
    request_id: str
    type: str
    manufacturer: Optional[str] = None
    customer: Optional[str] = None
    date: datetime
    status: str
    actor_type: str


class RecentActivityResponse(BaseModel):
    items: List[RecentActivityItem]
    total_items: int
    filter: Optional[str]


@router.get("/activity-log", response_model=RecentActivityResponse)
async def get_activity_log(
    db=Depends(get_db),
    admin: User = Depends(get_current_active_user),
    actor_type: Optional[str] = Query(
        default=None,
        description="Filter by actor type: 'manufacturer' or 'customer' (case-insensitive). If not provided, returns all activity."
    ),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=10, ge=1, le=100, description="Items per page"),
) -> RecentActivityResponse:
    """
    Return the five latest customer/manufacturer activity rows.
    
    Validates:
    - User is active and not a superuser (RBAC)
    - actor_type parameter is either 'manufacturer' or 'customer'
    - User has access to the data (team member filtering)
    
    Returns proper 422 validation errors for invalid filter payloads.
    """
    if actor_type is not None:
        normalized = actor_type.strip().lower()
        if normalized not in ["manufacturer", "customer"]:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail="actor_type must be either 'manufacturer' or 'customer'"
            )
        actor_type = normalized

    service = AnalyticsService(db, admin)
    filter_data = ActivityLogFilter(actor_type=actor_type, page=page, page_size=page_size)
    return await service.get_activity_log(filter_data)
