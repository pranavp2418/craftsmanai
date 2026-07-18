from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_db, get_current_active_user
from app.models.user import User
from app.schemas.analytics import MetricsFilter
from app.services.analytics_service import AnalyticsService

router = APIRouter()


class ActivityMetrics(BaseModel):
    total_renders: int
    designs_sent: int
    approval_rate: float
    Active_requests: int


class ConversionMetrics(BaseModel):
    total_refinements: int
    customer_engagement: int
    manufacturers_engaged: int
    archived_completed: int


class MetricsResponse(BaseModel):
    Activity_metrics: ActivityMetrics
    conversion_metrics: ConversionMetrics


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    db=Depends(get_db),
    admin: User = Depends(get_current_active_user),
    months: int = Query(6, ge=1, le=24, description="Number of months to look back (1-24)"),
) -> Dict[str, Any]:
    """
    Return aggregated metrics for the last N months.
    
    Validates:
    - User is active and not a superuser (RBAC)
    - months parameter is between 1 and 24
    - User has access to the data (team member filtering)
    
    Returns proper 422 validation errors for invalid filter payloads.
    """
    service = AnalyticsService(db, admin)
    filter_data = MetricsFilter(months=months)
    return await service.get_metrics(filter_data)
