from math import ceil
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime
from app.core.timezone import now as tz_now
from typing import Any, Optional

from app.core.dependencies import get_db, get_current_superuser as get_current_admin
from app.models.subscription import UserSubscription, CancellationReason, SubscriptionStatus
from app.models.user import User
from app.schemas.subscription import (
    CancellationSummaryResponse,
    CancellationReasonsResponse, 
    CancellationTrendsResponse
)

router = APIRouter()


@router.get("/summary", response_model=CancellationSummaryResponse)
def get_cancellation_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Get summary metrics for cancellations:
    - Total Cancellations
    - Churn Rate (for the current month)
    - Average Tenure Before Cancellation (in months)
    - Key Insight
    """
    # 1. Total Cancellations
    total_cancelled = db.query(func.count(UserSubscription.id)).filter(
        UserSubscription.status == SubscriptionStatus.CANCELLED
    ).scalar() or 0

    # 2. Average Tenure (in months)
    tenures = db.query(
        UserSubscription.start_date,
        UserSubscription.updated_at
    ).filter(UserSubscription.status == SubscriptionStatus.CANCELLED).all()
    
    avg_tenure_months = 0.0
    if tenures:
        total_days = 0
        for start_date, updated_at in tenures:
            if start_date and updated_at:
                delta = updated_at - start_date
                total_days += delta.days
        avg_tenure_months = round((total_days / len(tenures)) / 30.44, 1)

    # 3. Churn Rate (Current Month)
    now = tz_now()
    start_of_current_month = datetime(now.year, now.month, 1)
    
    cancelled_this_month = db.query(func.count(UserSubscription.id)).filter(
        and_(
            UserSubscription.status == SubscriptionStatus.CANCELLED,
            UserSubscription.updated_at >= start_of_current_month
        )
    ).scalar() or 0
    
    current_active = db.query(func.count(UserSubscription.id)).filter(
        UserSubscription.status == SubscriptionStatus.ACTIVE
    ).scalar() or 0
    
    total_at_start = current_active + cancelled_this_month
    churn_rate = round((cancelled_this_month / total_at_start * 100), 1) if total_at_start > 0 else 0.0

    # 4. Key Insight
    top_reason_row = (
        db.query(
            UserSubscription.cancellation_reason, 
            func.count(UserSubscription.id).label("count")
        )
        .filter(
            and_(
                UserSubscription.status == SubscriptionStatus.CANCELLED,
                UserSubscription.cancellation_reason.isnot(None)
            )
        )
        .group_by(UserSubscription.cancellation_reason)
        .order_by(func.count(UserSubscription.id).desc())
        .limit(1)
        .first()
    )
    
    key_insight_primary = "Monitoring churn patterns helps improve retention."
    key_insight_secondary = "No specific primary reason identified yet."
    
    if top_reason_row:
        reason = top_reason_row[0]
        count = top_reason_row[1]
        percentage = round((count / total_cancelled * 100), 0) if total_cancelled > 0 else 0
        
        reason_val = reason.value if hasattr(reason, 'value') else reason
        
        if reason_val == CancellationReason.TOO_EXPENSIVE.value:
            key_insight_primary = "The top cancellation reason is pricing sensitivity. Consider introducing a lower-tier plan or a pause option to reduce churn."
            key_insight_secondary = f"{int(percentage)}% of cancellations cite cost as the primary reason. A discounted annual plan or a 'Lite' tier could recover up to 15% of churned retailers."
        elif reason_val == CancellationReason.NOT_USING_ENOUGH.value:
            key_insight_primary = "Users report not using the platform enough. Focus on engagement features and onboarding."
            key_insight_secondary = f"{int(percentage)}% of cancellations are due to low usage. Re-engagement emails or feature highlights could help."
        else:
            key_insight_primary = f"Monitoring '{reason_val}' trend. {int(percentage)}% of cancellations cite this as the primary reason."
            key_insight_secondary = f"Consider strategic adjustments to address {reason_val.lower()} concerns."

    data = {
        "totalCancellations": total_cancelled,
        "churnRate": churn_rate,
        "avgTenure": avg_tenure_months,
        "keyInsight": {
            "primary": key_insight_primary,
            "secondary": key_insight_secondary
        }
    }
    
    return {
        "success": True, 
        "data": data
    }


@router.get("/reasons", response_model=CancellationReasonsResponse)
def get_cancellation_reasons(
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Number of records per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Get breakdown of cancellation reasons for the donut chart.
    """
    total_cancelled = db.query(func.count(UserSubscription.id)).filter(
        UserSubscription.status == SubscriptionStatus.CANCELLED
    ).scalar() or 0
    
    rows = (
        db.query(
            UserSubscription.cancellation_reason,
            func.count(UserSubscription.id)
        )
        .filter(UserSubscription.status == SubscriptionStatus.CANCELLED)
        .group_by(UserSubscription.cancellation_reason)
        .order_by(func.count(UserSubscription.id).desc())
        .limit(limit)
        .offset((page - 1) * limit)
        .all()
    )
    
    reasons_list = []
    for reason_obj, count in rows:
        if reason_obj:
            val = reason_obj.value if hasattr(reason_obj, 'value') else reason_obj
            percentage = round((count / total_cancelled * 100), 1) if total_cancelled > 0 else 0
            reasons_list.append({
                "reason": val,
                "count": count,
                "percentage": percentage
            })
    
    total_reasons = db.query(func.count(func.distinct(UserSubscription.cancellation_reason))).filter(
        and_(
            UserSubscription.status == SubscriptionStatus.CANCELLED,
            UserSubscription.cancellation_reason.isnot(None)
        )
    ).scalar() or 0
    
    total_pages = ceil(total_reasons / limit) if limit > 0 else 1

    return {
        "success": True,
        "data": reasons_list,
        "total": total_reasons,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }


@router.get("/trends", response_model=CancellationTrendsResponse)
def get_cancellation_trends(
    months: int = Query(6, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
):
    """
    Get monthly cancellation counts for the bar chart.
    """
    trends = []
    now = tz_now()
    
    for i in range(months - 1, -1, -1):
        year = now.year
        month = now.month - i
        while month <= 0:
            month += 12
            year -= 1
        
        start_of_month = datetime(year, month, 1)
        if month == 12:
            end_of_month = datetime(year + 1, 1, 1)
        else:
            end_of_month = datetime(year, month + 1, 1)
            
        count = db.query(func.count(UserSubscription.id)).filter(
            and_(
                UserSubscription.status == SubscriptionStatus.CANCELLED,
                UserSubscription.updated_at >= start_of_month,
                UserSubscription.updated_at < end_of_month
            )
        ).scalar() or 0
        
        trends.append({
            "month": start_of_month.strftime("%b"),
            "count": count,
            "year": year
        })
        
    return {
        "success": True,
        "data": trends
    }


@router.get("/list", status_code=200)
def get_cancelled_subscriptions(
    db: Session = Depends(get_db),
    reason: Optional[str] = Query(None, description="Filter by cancellation reason"),
    search: Optional[str] = Query(None, description="Search by retailer name or email"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Get all cancelled subscriptions (Admin only).
    Returns retailer name, plan name, status, cancellation reason and date.
    """
    from app.models.subscription import UserSubscription, SubscriptionPlan, SubscriptionStatus, CancellationReason
    from app.models.user import User
    from sqlalchemy.orm import joinedload
    from sqlalchemy import desc, or_, cast, String
    from typing import Any, Optional

    query = db.query(UserSubscription).join(User, User.id == UserSubscription.user_id).filter(
        UserSubscription.status == SubscriptionStatus.CANCELLED
    )

    # Search filter
    if search:
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )

    # Cancellation Reason filter
    if reason and reason.lower() != "all":
        # Map user input variations to database CancellationReason enum values
        reason_map = {
            "too expensive": CancellationReason.TOO_EXPENSIVE,
            "not using the platform enough": CancellationReason.NOT_USING_ENOUGH,
            "not using enough": CancellationReason.NOT_USING_ENOUGH,
            "found an alternative solution": CancellationReason.FOUND_ALTERNATIVE,
            "found alternative": CancellationReason.FOUND_ALTERNATIVE,
            "store closed temporarily": CancellationReason.STORE_CLOSED,
            "store closed": CancellationReason.STORE_CLOSED,
            "other reason": CancellationReason.OTHER,
            "other": CancellationReason.OTHER
        }
        
        mapped_reason = reason_map.get(reason.strip().lower())
        if mapped_reason:
            query = query.filter(UserSubscription.cancellation_reason == mapped_reason)
        else:
            query = query.filter(cast(UserSubscription.cancellation_reason, String).ilike(f"%{reason}%"))

    # Load relationship fields
    query = query.options(
        joinedload(UserSubscription.user),
        joinedload(UserSubscription.plan)
    ).order_by(desc(UserSubscription.cancellation_date))

    # Pagination
    total = query.count()
    offset = (page - 1) * limit
    subscriptions = query.offset(offset).limit(limit).all()

    formatted_data = []
    for sub in subscriptions:
        user = sub.user
        plan = sub.plan
        formatted_data.append({
            "id": str(sub.id),
            "retailer_name": user.full_name or user.email if user else "Unknown User",
            "plan_name": plan.name if plan else "Unknown Plan",
            "status": "cancelled",
            "cancellation_reason": sub.cancellation_reason.value if (sub.cancellation_reason and hasattr(sub.cancellation_reason, 'value')) else (str(sub.cancellation_reason) if sub.cancellation_reason else None),
            "cancellation_date": sub.cancellation_date.isoformat() if sub.cancellation_date else None,
            "end_date": sub.end_date.isoformat() if sub.end_date else None
        })

    return {
        "success": True,
        "data": formatted_data,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit
        }
    }