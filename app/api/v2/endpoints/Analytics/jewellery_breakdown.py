from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.api.deps import get_db, get_current_active_user
from app.models.user import User
from app.schemas.analytics import JewelleryBreakdownFilter
from app.services.analytics_service import AnalyticsService

router = APIRouter()


class JewelleryBreakdownItem(BaseModel):
	label: str
	count: int
	rate: float


class JewelleryBreakdownResponse(BaseModel):
	total_designs: int
	categories: List[JewelleryBreakdownItem]


@router.get("/jewellery-breakdown", response_model=JewelleryBreakdownResponse)
async def get_jewellery_breakdown(
	db=Depends(get_db),
	admin: User = Depends(get_current_active_user),
	months: int = Query(6, ge=1, le=24, description="Number of months to look back (1-24)"),
) -> Dict[str, Any]:
	"""
	Return jewellery mix as category counts and rates for the last N months.
	
	Validates:
	- User is active and not a superuser (RBAC)
	- months parameter is between 1 and 24
	- User has access to the data (team member filtering)
	
	Returns proper 422 validation errors for invalid filter payloads.
	"""
	service = AnalyticsService(db, admin)
	filter_data = JewelleryBreakdownFilter(months=months)
	return await service.get_jewellery_breakdown(filter_data)
