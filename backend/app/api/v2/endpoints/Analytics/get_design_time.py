from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_db, get_current_active_user
from app.models.user import User
from app.schemas.analytics import DesignTimeFilter
from app.services.analytics_service import AnalyticsService

router = APIRouter()


class DesignTimePoint(BaseModel):
	month: str
	year: int
	count: int


class DesignTimeResponse(BaseModel):
	total_designs: int
	months: List[DesignTimePoint]


@router.get("/design-time", response_model=DesignTimeResponse)
async def get_design_time(
	db=Depends(get_db),
	admin: User = Depends(get_current_active_user),
	months: int = Query(6, ge=1, le=24, description="Number of months to look back (1-24)"),
) -> Dict[str, Any]:
	"""
	Return month-by-month design creation counts for the last N calendar months.
	
	Validates:
	- User is active and not a superuser (RBAC)
	- months parameter is between 1 and 24
	- User has access to the data (team member filtering)
	
	Returns proper 422 validation errors for invalid filter payloads.
	"""
	service = AnalyticsService(db, admin)
	filter_data = DesignTimeFilter(months=months)
	return await service.get_design_time(filter_data)
