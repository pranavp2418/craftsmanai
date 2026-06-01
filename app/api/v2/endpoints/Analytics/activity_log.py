from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.design import Design, DesignShare, DesignShareStatus, DesignVariant, DesignVariantManufacturerShare, ManufacturerShareStatus
from app.models.manufacturer import Manufacturer
from app.models.order import Order
from app.models.user import User

router = APIRouter()


class RecentActivityItem(BaseModel):
    request_id: str
    type: str
    manufacturer: Optional[str] = None
    date: datetime
    status: str
    actor_type: Literal["manufacturer", "customer"]


class RecentActivityResponse(BaseModel):
    items: List[RecentActivityItem]
    total_items: int
    filter: str


CUSTOMER_STATUS_LABELS = {
    DesignShareStatus.PENDING: "Sent to Customer",
    DesignShareStatus.ACCEPTED: "Customer Approved",
    DesignShareStatus.REJECTED: "Customer Rejected",
    DesignShareStatus.NEEDS_REFINEMENT: "Needs Refinement",
}

MANUFACTURER_STATUS_LABELS = {
    ManufacturerShareStatus.PENDING: "Sent to Manufacturer",
    ManufacturerShareStatus.QUOTED: "Quote Submitted",
    ManufacturerShareStatus.ACCEPTED: "Manufacturer Accepted",
    ManufacturerShareStatus.REJECTED: "Manufacturer Rejected",
}


def _design_label(design: Optional[Design]) -> str:
    if not design:
        return "Design"
    return design.jewellery_type or design.name or "Design"


def _request_id(design: Optional[Design], fallback_id: int) -> str:
    if design and design.design_code:
        return design.design_code
    return f"REQ-{fallback_id}"


def _normalize_filter(value: Optional[str]) -> Literal["manufacturer", "customer"]:
    normalized = (value or "manufacturer").strip().lower()
    if normalized == "customer":
        return "customer"
    return "manufacturer"


@router.get("/activity-log", response_model=RecentActivityResponse)
async def get_activity_log(
    db: AsyncSession = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_active_user),
    actor_type: Optional[str] = Query("manufacturer", description="Filter by manufacturer or customer"),
) -> Dict[str, Any]:
    """Return the five latest customer/manufacturer activity rows."""
    normalized_filter = _normalize_filter(actor_type)
    items: List[Dict[str, Any]] = []

    if normalized_filter == "customer":
        customer_result = await db.execute(
            select(DesignShare, Design, Manufacturer.name)
            .join(DesignShare.design_variant)
            .join(DesignVariant.design)
            .outerjoin(DesignShare.order)
            .outerjoin(Order.manufacturer)
            .order_by(DesignShare.created_at.desc())
        )

        for share, design, manufacturer_name in customer_result.all():
            created_at = share.reviewed_at or share.created_at
            if created_at is None:
                continue
            items.append(
                {
                    "request_id": _request_id(design, share.id),
                    "type": _design_label(design),
                    "manufacturer": manufacturer_name,
                    "date": created_at,
                    "status": CUSTOMER_STATUS_LABELS.get(share.status, "Customer Update"),
                    "actor_type": "customer",
                }
            )

    if normalized_filter == "manufacturer":
        manufacturer_result = await db.execute(
            select(DesignVariantManufacturerShare, Design, Manufacturer.name)
            .join(DesignVariantManufacturerShare.design_variant)
            .join(DesignVariant.design)
            .join(DesignVariantManufacturerShare.manufacturer)
            .order_by(DesignVariantManufacturerShare.created_at.desc())
        )

        for share, design, manufacturer_name in manufacturer_result.all():
            created_at = share.created_at
            if created_at is None:
                continue
            items.append(
                {
                    "request_id": _request_id(design, share.id),
                    "type": _design_label(design),
                    "manufacturer": manufacturer_name,
                    "date": created_at,
                    "status": MANUFACTURER_STATUS_LABELS.get(share.status, "Manufacturer Update"),
                    "actor_type": "manufacturer",
                }
            )

    items.sort(key=lambda item: item["date"], reverse=True)
    total_items = len(items)
    items = items[:5]

    return {
        "items": items,
        "total_items": total_items,
        "filter": normalized_filter,
    }
