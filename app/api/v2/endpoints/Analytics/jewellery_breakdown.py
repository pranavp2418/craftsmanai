from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.api.deps import get_db,get_current_active_user
from app.models.design import Design
from app.models.user import User

router = APIRouter()


class JewelleryBreakdownItem(BaseModel):
	label: str
	count: int
	rate: float


class JewelleryBreakdownResponse(BaseModel):
	total_designs: int
	categories: List[JewelleryBreakdownItem]


def normalize_jewellery_type(raw_value: str | None) -> str:
	"""Map free-text jewellery_type values to the UI categories."""
	value = (raw_value or "").strip().lower()
	if not value:
		return "Other"

	if any(word in value for word in ("ring", "band", "cocktail ring", "engagement", "wedding")):
		return "Rings"
	if any(word in value for word in ("necklace", "chain", "pendant", "neck piece", "choker")):
		return "Necklaces"
	if any(word in value for word in ("earring", "stud", "hoop", "dangl", "drop")):
		return "Earrings"
	if any(word in value for word in ("bracelet", "bangle", "cuff", "arm")):
		return "Bracelets"
	if any(word in value for word in ("pendant",)):
		return "Pendants"
	return "Other"


@router.get("/jewellery-breakdown", response_model=JewelleryBreakdownResponse)
async def get_jewellery_breakdown(
	db: AsyncSession = Depends(get_db),
	admin: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
	"""Return last-six-month jewellery mix as category counts and rates."""
	cutoff = datetime.now(timezone.utc) - timedelta(days=183)

	result = await db.execute(
		select(Design.jewellery_type, func.count(Design.id)).where(
			Design.created_at >= cutoff,
			Design.is_deleted.is_(False),
		).group_by(Design.jewellery_type)
	)

	category_counts = defaultdict(int)
	for jewellery_type, count in result.all():
		category = normalize_jewellery_type(jewellery_type)
		category_counts[category] += count or 0

	order = ["Rings", "Necklaces", "Earrings", "Bracelets", "Pendants", "Other"]
	total_designs = sum(category_counts.values())

	categories = []
	for label in order:
		count = category_counts.get(label, 0)
		rate = round((count / total_designs) * 100, 1) if total_designs else 0.0
		categories.append(
			JewelleryBreakdownItem(
				label=label,
				count=count,
				rate=rate,
			)
		)

	return {
		"total_designs": total_designs,
		"categories": categories,
	}
