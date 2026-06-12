from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db,get_current_active_user
from app.models.design import (
    Design,
    DesignShare,
    DesignShareStatus,
    DesignStatus,
    DesignVariant,
    DesignVariantManufacturerShare,
)
from app.models.user import User

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
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """Return aggregated metrics for the last six months."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=183)

    # Filter based on whether user is team member or team owner/regular user
    owner_id = admin.team_owner_id if admin.is_team_member and admin.team_owner_id else admin.id
    design_filter = Design.user_id == owner_id

    total_renders_res = await db.execute(
        select(func.count(DesignVariant.id))
        .join(Design, DesignVariant.design_id == Design.id)
        .where(
            and_(
                DesignVariant.created_at >= cutoff,
                design_filter,
            )
        )
    )
    total_renders = total_renders_res.scalar() or 0

    designs_sent_res = await db.execute(
        select(func.count(DesignShare.id))
        .join(DesignShare.design_variant)
        .join(DesignVariant.design)
        .where(
            and_(
                DesignShare.created_at >= cutoff,
                design_filter,
            )
        )
    )
    designs_sent = designs_sent_res.scalar() or 0

    approvals_res = await db.execute(
        select(func.count(DesignShare.id))
        .join(DesignShare.design_variant)
        .join(DesignVariant.design)
        .where(
            and_(
                DesignShare.created_at >= cutoff,
                DesignShare.status == DesignShareStatus.ACCEPTED,
                design_filter,
            )
        )
    )
    approvals = approvals_res.scalar() or 0
    approval_rate = round((approvals / designs_sent) * 100, 2) if designs_sent else 0.0

    active_requests_res = await db.execute(
        # Active requests means any design request that has not reached COMPLETED yet.
        select(func.count(Design.id)).where(
            and_(
                Design.created_at >= cutoff,
                Design.status != DesignStatus.COMPLETED,
                design_filter,
            )
        )
    )
    active_requests = active_requests_res.scalar() or 0

    total_refinements_res = await db.execute(
        select(func.count(DesignVariant.id))
        .join(Design, DesignVariant.design_id == Design.id)
        .where(
            and_(
                DesignVariant.created_at >= cutoff,
                DesignVariant.version_number > 0,
                DesignVariant.is_deleted.is_(False),
                design_filter,
            )
        )
    )
    total_refinements = total_refinements_res.scalar() or 0

    customer_engagement_res = await db.execute(
        select(func.count(DesignShare.id))
        .join(DesignShare.design_variant)
        .join(DesignVariant.design)
        .where(
            and_(
                DesignShare.created_at >= cutoff,
                DesignShare.status.in_(
                    [
                        DesignShareStatus.ACCEPTED,
                        DesignShareStatus.REJECTED,
                        DesignShareStatus.NEEDS_REFINEMENT,
                    ]
                ),
                design_filter,
            )
        )
    )
    customer_engagement = customer_engagement_res.scalar() or 0

    manufacturers_engaged_res = await db.execute(
        select(func.count(func.distinct(DesignVariantManufacturerShare.manufacturer_id)))
        .join(DesignVariantManufacturerShare.design_variant)
        .join(DesignVariant.design)
        .where(
            and_(
                DesignVariantManufacturerShare.created_at >= cutoff,
                design_filter,
            )
        )
    )
    manufacturers_engaged = manufacturers_engaged_res.scalar() or 0

    archived_completed_res = await db.execute(
        select(func.count(Design.id)).where(
            and_(
                Design.updated_at >= cutoff,
                or_(
                    Design.is_archived.is_(True),
                    Design.status == DesignStatus.COMPLETED,
                ),
                design_filter,
            )
        )
    )
    archived_completed = archived_completed_res.scalar() or 0

    return {
        "Activity_metrics": {
            "total_renders": total_renders,
            "designs_sent": designs_sent,
            "approval_rate": approval_rate,
            "Active_requests": active_requests,
        },
        "conversion_metrics": {
            "total_refinements": total_refinements,
            "customer_engagement": customer_engagement,
            "manufacturers_engaged": manufacturers_engaged,
            "archived_completed": archived_completed,
        },
    }
