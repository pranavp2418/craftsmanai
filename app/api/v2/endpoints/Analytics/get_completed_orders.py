from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db,get_current_active_user
from app.models.order import Order, OrderStatus
from app.models.user import User

router = APIRouter()


class CompletedOrdersTimePoint(BaseModel):
	month: str
	year: int
	count: int


class CompletedOrdersResponse(BaseModel):
	total_completed_orders: int
	months: List[CompletedOrdersTimePoint]


@router.get("/completed-orders", response_model=CompletedOrdersResponse)
async def get_completed_orders(
	db: AsyncSession = Depends(get_db),
	admin: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
	"""Return month-by-month completed orders for the last six calendar months."""
	now = datetime.now(timezone.utc)

	month_starts = []
	for offset in range(5, -1, -1):
		month_index = now.month - offset
		year = now.year
		while month_index <= 0:
			month_index += 12
			year -= 1
		month_starts.append(datetime(year, month_index, 1, tzinfo=timezone.utc))

	window_start = month_starts[0]
	window_end = now + timedelta(days=1)

	result = await db.execute(
		select(Order.created_at).where(
			Order.created_at >= window_start,
			Order.created_at < window_end,
			Order.status == OrderStatus.COMPLETED,
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
		counts[(created_at_dt.year, created_at_dt.month)] += 1

	months = []
	total_completed_orders = 0
	for month_start in month_starts:
		key = (month_start.year, month_start.month)
		month_count = counts.get(key, 0)
		total_completed_orders += month_count
		months.append(
			CompletedOrdersTimePoint(
				month=month_start.strftime("%b"),
				year=month_start.year,
				count=month_count,
			)
		)

	return {
		"total_completed_orders": total_completed_orders,
		"months": months,
	}
