from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import and_, func, or_, select, distinct
from fastapi import HTTPException, status

from app.models.design import Design, DesignShare, DesignShareStatus, DesignStatus, DesignVariant, DesignVariantManufacturerShare, ManufacturerShareStatus
from app.models.manufacturer import Manufacturer
from app.models.customer import Customer
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.schemas.analytics import (
    ActivityLogFilter,
    AnalyticsErrorResponse,
    CompletedOrdersFilter,
    ConversionFunnelFilter,
    DesignTimeFilter,
    JewelleryBreakdownFilter,
    MetricsFilter,
)


class AnalyticsService:
    """Service class for analytics operations with proper validation and RBAC"""

    def __init__(self, db, user: User):
        self.db = db
        self.user = user
        self.owner_id = self._get_owner_id()

    def _get_owner_id(self) -> int:
        """Get the owner ID for data filtering based on user role"""
        if self.user.is_team_member and self.user.team_owner_id:
            return self.user.team_owner_id
        return self.user.id

    def _get_design_filter(self):
        """Get the base design filter for the current user"""
        return Design.user_id == self.owner_id

    def _validate_user_permissions(self):
        """Validate user has permission to access analytics"""
        if not self.user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user cannot access analytics"
            )

        if self.user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Superusers cannot access analytics endpoints"
            )

    def _validate_months_range(self, months: int) -> int:
        """Validate months parameter is within acceptable range"""
        if months < 1 or months > 24:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Months must be between 1 and 24, got {months}"
            )
        return months

    def _calculate_cutoff(self, months: int = 6) -> datetime:
        """Calculate the cutoff date for the given number of months"""
        self._validate_months_range(months)
        return datetime.now(timezone.utc) - timedelta(days=30.44 * months)  # Average days per month

    def _build_month_starts(self, months: int = 6) -> List[datetime]:
        """Build list of month start dates for the last N calendar months"""
        self._validate_months_range(months)
        now = datetime.now(timezone.utc)
        month_starts = []
        current_year = now.year
        current_month = now.month

        for offset in range(months - 1, -1, -1):
            month_index = current_month - offset
            year = current_year
            while month_index <= 0:
                month_index += 12
                year -= 1
            month_starts.append(datetime(year, month_index, 1, tzinfo=timezone.utc))

        return month_starts

    async def get_metrics(self, filter_data: MetricsFilter) -> Dict[str, Any]:
        """Get aggregated metrics with validation"""
        self._validate_user_permissions()
        months = self._validate_months_range(filter_data.months)
        cutoff = self._calculate_cutoff(months)
        design_filter = self._get_design_filter()

        try:
            # Total renders
            total_renders_res = await self.db.execute(
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

            # Designs sent
            designs_sent_res = await self.db.execute(
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

            # Approvals
            approvals_res = await self.db.execute(
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

            # Active requests
            active_requests_res = await self.db.execute(
                select(func.count(Design.id)).where(
                    and_(
                        Design.created_at >= cutoff,
                        Design.status != DesignStatus.COMPLETED,
                        design_filter,
                    )
                )
            )
            active_requests = active_requests_res.scalar() or 0

            # Total refinements
            total_refinements_res = await self.db.execute(
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

            # Customer engagement
            customer_engagement_res = await self.db.execute(
                select(func.count(DesignShare.id))
                .join(DesignShare.design_variant)
                .join(DesignVariant.design)
                .where(
                    and_(
                        DesignShare.created_at >= cutoff,
                        DesignShare.status.in_([
                            DesignShareStatus.ACCEPTED,
                            DesignShareStatus.REJECTED,
                            DesignShareStatus.NEEDS_REFINEMENT,
                        ]),
                        design_filter,
                    )
                )
            )
            customer_engagement = customer_engagement_res.scalar() or 0

            # Manufacturers engaged
            manufacturers_engaged_res = await self.db.execute(
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

            # Archived/completed
            archived_completed_res = await self.db.execute(
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
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve metrics: {str(e)}"
            )

    async def get_design_time(self, filter_data: DesignTimeFilter) -> Dict[str, Any]:
        """Get design time metrics with validation"""
        self._validate_user_permissions()
        months = self._validate_months_range(filter_data.months)
        month_starts = self._build_month_starts(months)
        window_start = month_starts[0]
        window_end = datetime.now(timezone.utc) + timedelta(days=1)
        design_filter = self._get_design_filter()

        try:
            result = await self.db.execute(
                select(Design.created_at).where(
                    Design.created_at >= window_start,
                    Design.created_at < window_end,
                    design_filter,
                )
            )
            rows = list(result.all())

            from collections import defaultdict
            counts = defaultdict(int)
            for (created_at,) in rows:
                if created_at is None:
                    continue
                created_at_dt = created_at
                if created_at_dt.tzinfo is None:
                    created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)
                counts[(created_at_dt.year, created_at_dt.month)] += 1

            months_data = []
            total_designs = 0
            for month_start in month_starts:
                key = (month_start.year, month_start.month)
                month_count = counts.get(key, 0)
                total_designs += month_count
                months_data.append({
                    "month": month_start.strftime("%b"),
                    "year": month_start.year,
                    "count": month_count,
                })

            return {
                "total_designs": total_designs,
                "months": months_data,
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve design time metrics: {str(e)}"
            )

    async def get_completed_orders(self, filter_data: CompletedOrdersFilter) -> Dict[str, Any]:
        """Get completed orders with validation"""
        self._validate_user_permissions()
        months = self._validate_months_range(filter_data.months)
        month_starts = self._build_month_starts(months)
        window_start = month_starts[0]
        window_end = datetime.now(timezone.utc) + timedelta(days=1)
        design_filter = self._get_design_filter()

        try:
            result = self.db.execute(
                select(Order.created_at)
                .join(Design, Order.design_id == Design.id)
                .where(
                    Order.created_at >= window_start,
                    Order.created_at < window_end,
                    Design.status == DesignStatus.COMPLETED,
                    design_filter,
                )
            )
            rows = result.all()

            from collections import defaultdict
            counts = defaultdict(int)
            for (created_at,) in rows:
                if created_at is None:
                    continue
                created_at_dt = created_at
                if created_at_dt.tzinfo is None:
                    created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)
                counts[(created_at_dt.year, created_at_dt.month)] += 1

            months_data = []
            total_completed_orders = 0
            for month_start in month_starts:
                key = (month_start.year, month_start.month)
                month_count = counts.get(key, 0)
                total_completed_orders += month_count
                months_data.append({
                    "month": month_start.strftime("%b"),
                    "year": month_start.year,
                    "count": month_count,
                })

            return {
                "total_completed_orders": total_completed_orders,
                "months": months_data,
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve completed orders: {str(e)}"
            )

    async def get_conversion_funnel(self, filter_data: ConversionFunnelFilter) -> Dict[str, Any]:
        """Get conversion funnel with validation"""
        self._validate_user_permissions()
        months = self._validate_months_range(filter_data.months)
        cutoff = self._calculate_cutoff(months)
        design_filter = self._get_design_filter()

        try:
            from statistics import mean

            # Requests
            requests_res = await self.db.execute(
                select(func.count(Design.id)).where(
                    and_(
                        Design.created_at >= cutoff,
                        Design.is_deleted.is_(False),
                        design_filter,
                    )
                )
            )
            requests = requests_res.scalar() or 0

            # Rendered
            rendered_res = await self.db.execute(
                select(func.count(distinct(DesignVariant.design_id)))
                .join(Design, DesignVariant.design_id == Design.id)
                .where(
                    and_(
                        DesignVariant.created_at >= cutoff,
                        DesignVariant.version_number == 0,
                        DesignVariant.is_deleted.is_(False),
                        design_filter,
                    )
                )
            )
            rendered = rendered_res.scalar() or 0

            # Sent
            sent_res = await self.db.execute(
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
            sent = sent_res.scalar() or 0

            # Approved
            approved_res = await self.db.execute(
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
            approved = approved_res.scalar() or 0

            # Manufactured
            manufactured_res = await self.db.execute(
                select(func.count(Order.id))
                .join(Design, Order.design_id == Design.id)
                .where(
                    and_(
                        Design.status == DesignStatus.COMPLETED,
                        Order.created_at >= cutoff,
                        design_filter,
                    )
                )
            )
            manufactured = manufactured_res.scalar() or 0

            # Average time to approval
            approval_rows = await self.db.execute(
                select(DesignShare.created_at, DesignShare.reviewed_at)
                .join(DesignShare.design_variant)
                .join(DesignVariant.design)
                .where(
                    and_(
                        DesignShare.created_at >= cutoff,
                        DesignShare.status == DesignShareStatus.ACCEPTED,
                        DesignShare.reviewed_at.is_not(None),
                        design_filter,
                    )
                )
            )

            def _to_aware(value):
                if value is None:
                    return None
                if value.tzinfo is None:
                    return value.replace(tzinfo=timezone.utc)
                return value

            approval_durations = []
            for created_at, reviewed_at in list(approval_rows.all()):
                created = _to_aware(created_at)
                reviewed = _to_aware(reviewed_at)
                if created and reviewed and reviewed >= created:
                    approval_durations.append((reviewed - created).total_seconds() / 86400.0)

            avg_time_to_approval_days = round(mean(approval_durations), 1) if approval_durations else 0.0

            # Average refinements per design
            refinements_res = await self.db.execute(
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
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve conversion funnel: {str(e)}"
            )

    async def get_jewellery_breakdown(self, filter_data: JewelleryBreakdownFilter) -> Dict[str, Any]:
        """Get jewellery breakdown with validation"""
        self._validate_user_permissions()
        months = self._validate_months_range(filter_data.months)
        cutoff = self._calculate_cutoff(months)
        design_filter = self._get_design_filter()

        try:
            result = await self.db.execute(
                select(Design.jewellery_type, func.count(Design.id)).where(
                    Design.created_at >= cutoff,
                    Design.is_deleted.is_(False),
                    design_filter,
                ).group_by(Design.jewellery_type)
            )

            from collections import defaultdict
            category_counts = defaultdict(int)

            def normalize_jewellery_type(raw_value: str | None) -> str:
                value = (raw_value or "").strip().lower()
                if not value:
                    return "Other"
                if any(word in value for word in ("ring", "band", "cocktail ring", "engagement", "wedding")):
                    return "Rings"
                if any(word in value for word in ("necklace", "chain", "neck piece", "choker")):
                    return "Necklaces"
                if any(word in value for word in ("earring", "stud", "hoop", "dangl", "drop")):
                    return "Earrings"
                if any(word in value for word in ("bracelet", "bangle", "cuff", "arm")):
                    return "Bracelets"
                if any(word in value for word in ("pendant",)):
                    return "Pendants"
                return "Other"

            for jewellery_type, count in list(result.all()):
                category = normalize_jewellery_type(jewellery_type)
                category_counts[category] += count or 0

            order = ["Rings", "Necklaces", "Earrings", "Bracelets", "Pendants", "Other"]
            total_designs = sum(category_counts.values())

            categories = []
            for label in order:
                count = category_counts.get(label, 0)
                rate = round((count / total_designs) * 100, 1) if total_designs else 0.0
                categories.append({
                    "label": label,
                    "count": count,
                    "rate": rate,
                })

            return {
                "total_designs": total_designs,
                "categories": categories,
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve jewellery breakdown: {str(e)}"
            )

    async def get_activity_log(self, filter_data: ActivityLogFilter) -> Dict[str, Any]:
        """Get activity log with validation"""
        self._validate_user_permissions()
        normalized_filter = filter_data.actor_type
        if normalized_filter is not None:
            normalized_filter = normalized_filter.strip().lower()
            if normalized_filter not in ["manufacturer", "customer"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="actor_type must be either 'manufacturer' or 'customer'"
                )
        design_filter = self._get_design_filter()

        try:
            items = []

            # If no actor_type specified, return all data
            if not normalized_filter:
            # Fetch both customer and manufacturer data
                customer_result = await self.db.execute(
                    select(DesignShare, Design, Manufacturer.name, Customer.full_name)
                    .join(DesignShare.design_variant)
                    .join(DesignVariant.design)
                    .outerjoin(Customer, DesignShare.customer_id == Customer.id)
                    .outerjoin(DesignShare.order)
                    .outerjoin(Order.manufacturer)
                    .where(design_filter)
                    .order_by(DesignShare.created_at.desc())
                )

                CUSTOMER_STATUS_LABELS = {
                    DesignShareStatus.PENDING: "Sent to Customer",
                    DesignShareStatus.ACCEPTED: "Customer Approved",
                    DesignShareStatus.REJECTED: "Customer Rejected",
                    DesignShareStatus.NEEDS_REFINEMENT: "Needs Refinement",
                }

                def _design_label(design):
                    if not design:
                        return "Design"
                    return design.jewellery_type or design.name or "Design"

                def _request_id(design, fallback_id):
                    if design and design.design_code:
                        return design.design_code
                    return f"REQ-{fallback_id}"

                for share, design, manufacturer_name, customer_name in list(customer_result.all()):
                    created_at = share.reviewed_at or share.created_at
                    if created_at is None:
                        continue
                    items.append({
                        "request_id": _request_id(design, share.id),
                        "type": _design_label(design),
                        "manufacturer": manufacturer_name,
                        "customer": customer_name,
                        "date": created_at,
                        "status": CUSTOMER_STATUS_LABELS.get(share.status, "Customer Update"),
                        "actor_type": "customer",
                    })

                manufacturer_result = await self.db.execute(
                    select(DesignVariantManufacturerShare, Design, Manufacturer.name)
                    .join(DesignVariantManufacturerShare.design_variant)
                    .join(DesignVariant.design)
                    .join(DesignVariantManufacturerShare.manufacturer)
                    .where(design_filter)
                    .order_by(DesignVariantManufacturerShare.created_at.desc())
                )

                MANUFACTURER_STATUS_LABELS = {
                    ManufacturerShareStatus.PENDING: "Sent to Manufacturer",
                    ManufacturerShareStatus.QUOTED: "Quote Submitted",
                    ManufacturerShareStatus.ACCEPTED: "Manufacturer Accepted",
                    ManufacturerShareStatus.REJECTED: "Manufacturer Rejected",
                }

                for share, design, manufacturer_name in list(manufacturer_result.all()):
                    created_at = share.created_at
                    if created_at is None:
                        continue
                    items.append({
                        "request_id": _request_id(design, share.id),
                        "type": _design_label(design),
                        "manufacturer": manufacturer_name,
                        "customer": None,
                        "date": created_at,
                        "status": MANUFACTURER_STATUS_LABELS.get(share.status, "Manufacturer Update"),
                        "actor_type": "manufacturer",
                    })
            elif normalized_filter == "customer":
                customer_result = await self.db.execute(
                    select(DesignShare, Design, Manufacturer.name, Customer.full_name)
                    .join(DesignShare.design_variant)
                    .join(DesignVariant.design)
                    .outerjoin(Customer, DesignShare.customer_id == Customer.id)
                    .outerjoin(DesignShare.order)
                    .outerjoin(Order.manufacturer)
                    .where(design_filter)
                    .order_by(DesignShare.created_at.desc())
                )

                CUSTOMER_STATUS_LABELS = {
                    DesignShareStatus.PENDING: "Sent to Customer",
                    DesignShareStatus.ACCEPTED: "Customer Approved",
                    DesignShareStatus.REJECTED: "Customer Rejected",
                    DesignShareStatus.NEEDS_REFINEMENT: "Needs Refinement",
                }

                def _design_label(design):
                    if not design:
                        return "Design"
                    return design.jewellery_type or design.name or "Design"

                def _request_id(design, fallback_id):
                    if design and design.design_code:
                        return design.design_code
                    return f"REQ-{fallback_id}"

                for share, design, manufacturer_name, customer_name in list(customer_result.all()):
                    created_at = share.reviewed_at or share.created_at
                    if created_at is None:
                        continue
                    items.append({
                        "request_id": _request_id(design, share.id),
                        "type": _design_label(design),
                        "manufacturer": manufacturer_name,
                        "customer": customer_name,
                        "date": created_at,
                        "status": CUSTOMER_STATUS_LABELS.get(share.status, "Customer Update"),
                        "actor_type": "customer",
                    })

            elif normalized_filter == "manufacturer":
                manufacturer_result = await self.db.execute(
                    select(DesignVariantManufacturerShare, Design, Manufacturer.name)
                    .join(DesignVariantManufacturerShare.design_variant)
                    .join(DesignVariant.design)
                    .join(DesignVariantManufacturerShare.manufacturer)
                    .where(design_filter)
                    .order_by(DesignVariantManufacturerShare.created_at.desc())
                )

                MANUFACTURER_STATUS_LABELS = {
                    ManufacturerShareStatus.PENDING: "Sent to Manufacturer",
                    ManufacturerShareStatus.QUOTED: "Quote Submitted",
                    ManufacturerShareStatus.ACCEPTED: "Manufacturer Accepted",
                    ManufacturerShareStatus.REJECTED: "Manufacturer Rejected",
                }

                def _design_label(design):
                    if not design:
                        return "Design"
                    return design.jewellery_type or design.name or "Design"

                def _request_id(design, fallback_id):
                    if design and design.design_code:
                        return design.design_code
                    return f"REQ-{fallback_id}"

                for share, design, manufacturer_name in list(manufacturer_result.all()):
                    created_at = share.created_at
                    if created_at is None:
                        continue
                    items.append({
                        "request_id": _request_id(design, share.id),
                        "type": _design_label(design),
                        "manufacturer": manufacturer_name,
                        "customer": None,
                        "date": created_at,
                        "status": MANUFACTURER_STATUS_LABELS.get(share.status, "Manufacturer Update"),
                        "actor_type": "manufacturer",
                    })

            items.sort(key=lambda item: item["date"], reverse=True)
            total_items = len(items)
            
            # Apply pagination
            start_idx = (filter_data.page - 1) * filter_data.page_size
            end_idx = start_idx + filter_data.page_size
            paginated_items = items[start_idx:end_idx]

            return {
                "items": paginated_items,
                "total_items": total_items,
                "filter": normalized_filter,
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve activity log: {str(e)}"
            )