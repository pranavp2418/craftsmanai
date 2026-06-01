from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db,get_current_active_user
from app.models.design import Design
from app.models.user import User

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
	db: AsyncSession = Depends(get_db),
	admin: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
	"""Return month-by-month design creation counts for the last six calendar months."""
	now = datetime.now(timezone.utc)

	# Build the last six calendar months, including the current month.
	month_starts = []
	current_year = now.year
	current_month = now.month
	for offset in range(5, -1, -1):
		month_index = current_month - offset
		year = current_year
		while month_index <= 0:
			month_index += 12
			year -= 1
		month_starts.append(datetime(year, month_index, 1, tzinfo=timezone.utc))

	window_start = month_starts[0]
	window_end = now + timedelta(days=1)

	result = await db.execute(
		select(Design.created_at).where(
			Design.created_at >= window_start,
			Design.created_at < window_end,
		)
	)
	rows = result.all()

	counts = defaultdict(int)
	for (created_at,) in rows:
		if created_at is None:
			continue
		created_at_dt = created_at
		if created_at_dt.tzinfo is None:
			created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)
		bucket = (created_at_dt.year, created_at_dt.month)
		counts[bucket] += 1

	months = []
	total_designs = 0
	for month_start in month_starts:
		key = (month_start.year, month_start.month)
		month_count = counts.get(key, 0)
		total_designs += month_count
		months.append(
			DesignTimePoint(
				month=month_start.strftime("%b"),
				year=month_start.year,
				count=month_count,
			)
		)

	return {
		"total_designs": total_designs,
		"months": months,
	}
