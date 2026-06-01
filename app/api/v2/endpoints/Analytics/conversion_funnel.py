from __future__ import annotations

from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, func, select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user,get_db
from app.models.design import Design, DesignShare, DesignShareStatus, DesignVariant
from app.models.order import Order, OrderStatus
from app.models.user import User

router = APIRouter()


class FunnelStage(BaseModel):
	label: str
	count: int
	rate: float


class FunnelSummary(BaseModel):
	avg_time_to_approval_days: float
	avg_refinements_per_design: float
	conversion_rate: float


class ConversionFunnelResponse(BaseModel):
	stages: List[FunnelStage]
	summary: FunnelSummary


def _to_aware(value: Optional[datetime]) -> Optional[datetime]:
	if value is None:
		return None
	if value.tzinfo is None:
		return value.replace(tzinfo=timezone.utc)
	return value


@router.get("/conversion-funnel", response_model=ConversionFunnelResponse)
async def get_conversion_funnel(
	db: AsyncSession = Depends(get_db),
	admin: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
	"""Return six-month conversion funnel metrics matching the dashboard UI."""
	cutoff = datetime.now(timezone.utc) - timedelta(days=183)

	requests_res = await db.execute(
		select(func.count(Design.id)).where(
			and_(
				Design.created_at >= cutoff,
				Design.is_deleted.is_(False),
			)
		)
	)
	requests = requests_res.scalar() or 0

	rendered_res = await db.execute(
		select(func.count(distinct(DesignVariant.design_id))).where(
			and_(
				DesignVariant.created_at >= cutoff,
				DesignVariant.version_number == 0,
				DesignVariant.is_deleted.is_(False),
			)
		)
	)
	rendered = rendered_res.scalar() or 0

	sent_res = await db.execute(
		select(func.count(DesignShare.id)).where(
			DesignShare.created_at >= cutoff,
		)
	)
	sent = sent_res.scalar() or 0

	approved_res = await db.execute(
		select(func.count(DesignShare.id)).where(
			and_(
				DesignShare.created_at >= cutoff,
				DesignShare.status == DesignShareStatus.ACCEPTED,
			)
		)
	)
	approved = approved_res.scalar() or 0

	manufactured_res = await db.execute(
		select(func.count(Order.id)).where(
			and_(
				Order.status == OrderStatus.COMPLETED,
				Order.updated_at >= cutoff,
			)
		)
	)
	manufactured = manufactured_res.scalar() or 0

	# Average time to approval = average days from share sent to customer approval.
	approval_rows = await db.execute(
		select(DesignShare.created_at, DesignShare.reviewed_at).where(
			and_(
				DesignShare.created_at >= cutoff,
				DesignShare.status == DesignShareStatus.ACCEPTED,
				DesignShare.reviewed_at.is_not(None),
			)
		)
	)
	approval_durations = []
	for created_at, reviewed_at in approval_rows.all():
		created = _to_aware(created_at)
		reviewed = _to_aware(reviewed_at)
		if created and reviewed and reviewed >= created:
			approval_durations.append((reviewed - created).total_seconds() / 86400.0)

	avg_time_to_approval_days = round(mean(approval_durations), 1) if approval_durations else 0.0

	# Average refinements per design = total refinements / total requests.
	refinements_res = await db.execute(
		select(func.count(DesignVariant.id)).where(
			and_(
				DesignVariant.created_at >= cutoff,
				DesignVariant.version_number > 0,
				DesignVariant.is_deleted.is_(False),
			)
		)
	)
	total_refinements = refinements_res.scalar() or 0
	avg_refinements_per_design = round(total_refinements / requests, 1) if requests else 0.0

	conversion_rate = round((manufactured / requests) * 100, 1) if requests else 0.0

	def stage_rate(value: int) -> float:
		return round((value / requests) * 100, 1) if requests else 0.0

	return {
		"stages": [
			{"label": "Requests", "count": requests, "rate": 100.0 if requests else 0.0},
			{"label": "Rendered", "count": rendered, "rate": stage_rate(rendered)},
			{"label": "Sent", "count": sent, "rate": stage_rate(sent)},
			{"label": "Approved", "count": approved, "rate": stage_rate(approved)},
			{"label": "Manufactured", "count": manufactured, "rate": stage_rate(manufactured)},
		],
		"summary": {
			"avg_time_to_approval_days": avg_time_to_approval_days,
			"avg_refinements_per_design": avg_refinements_per_design,
			"conversion_rate": conversion_rate,
		},
	}
