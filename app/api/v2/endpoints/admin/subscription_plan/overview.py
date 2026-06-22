from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case
from datetime import datetime, timedelta, timezone

from app.core.dependencies import get_db, get_current_superuser as get_current_admin
from app.models.user import User
from app.models.subscription import SubscriptionPlan, UserSubscription, SubscriptionStatus

router = APIRouter()

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _get_previous_period(period: str) -> timedelta:
    """Get the previous period of same length for trend calculation."""
    if period == "7days":
        return timedelta(days=14)  # 7-14 days ago
    elif period == "30days":
        return timedelta(days=60)  # 30-60 days ago
    elif period == "90days":
        return timedelta(days=180)  # 90-180 days ago
    else:  # 12months
        return timedelta(days=730)  # 365-730 days ago


@router.get("/stats", response_model=Dict[str, Any])
def get_subscription_overview_stats(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
    period: str = Query("7days", description="7days, 30days, 90days, 12months")
) -> Any:
    """
    Get top-level overview statistics for the subscription dashboard.
    Includes MRR, ARR, Active Subscriptions, New Subscriptions, Churn Rate, and Total Revenue.
    """
    # Calculate time delta based on period
    now = datetime.now(timezone.utc)
    if period == "7days":
        start_date = now - timedelta(days=7)
    elif period == "30days":
        start_date = now - timedelta(days=30)
    elif period == "90days":
        start_date = now - timedelta(days=90)
    else:  # 12months
        start_date = now - timedelta(days=365)

    # Previous period for trend calculation
    prev_start = start_date - _get_previous_period(period)

    # 1. Active Subscriptions
    active_subs_count = db.query(func.count(UserSubscription.id)).filter(
        UserSubscription.status == SubscriptionStatus.ACTIVE
    ).scalar() or 0

    # 2. New Subscriptions in period
    new_subs_count = db.query(func.count(UserSubscription.id)).filter(
        UserSubscription.created_at >= start_date
    ).scalar() or 0

    # New subscriptions in previous period (for trend)
    prev_new_subs_count = db.query(func.count(UserSubscription.id)).filter(
        UserSubscription.created_at >= prev_start,
        UserSubscription.created_at < start_date
    ).scalar() or 0

    # 3. Monthly Recurring Revenue (MRR)
    mrr = db.query(func.sum(SubscriptionPlan.price / (SubscriptionPlan.duration_days / 30.0))).join(
        UserSubscription, UserSubscription.plan_id == SubscriptionPlan.id
    ).filter(UserSubscription.status == SubscriptionStatus.ACTIVE).scalar() or 0

    # 4. Total Platform Revenue
    total_revenue = db.query(func.sum(SubscriptionPlan.price)).join(
        UserSubscription, UserSubscription.plan_id == SubscriptionPlan.id
    ).scalar() or 0

    # Revenue in previous period (for trend)
    prev_revenue = db.query(func.sum(SubscriptionPlan.price)).join(
        UserSubscription, UserSubscription.plan_id == SubscriptionPlan.id
    ).filter(
        UserSubscription.created_at >= prev_start,
        UserSubscription.created_at < start_date
    ).scalar() or 0

    # 5. Churn Rate (simplified: cancelled in period / active at start + new)
    cancelled_count = db.query(func.count(UserSubscription.id)).filter(
        UserSubscription.status == SubscriptionStatus.CANCELLED,
        UserSubscription.updated_at >= start_date
    ).scalar() or 0
    
    # Cancelled in previous period (for trend)
    prev_cancelled_count = db.query(func.count(UserSubscription.id)).filter(
        UserSubscription.status == SubscriptionStatus.CANCELLED,
        UserSubscription.updated_at >= prev_start,
        UserSubscription.updated_at < start_date
    ).scalar() or 0

    total_relevant_subs = active_subs_count + cancelled_count
    churn_rate = (cancelled_count / total_relevant_subs * 100) if total_relevant_subs > 0 else 0

    prev_total_relevant = active_subs_count + prev_cancelled_count
    prev_churn_rate = (prev_cancelled_count / prev_total_relevant * 100) if prev_total_relevant > 0 else 0

    # Calculate trend percentages
    def calc_trend(current, previous):
        if previous == 0:
            return 0.0
        return float(round((current - previous) / previous * 100, 1))

    return {
        "mrr": float(round(mrr, 2)),
        "arr": float(round(mrr * 12, 2)),
        "active_subscriptions": active_subs_count,
        "new_subscriptions": new_subs_count,
        "churn_rate": float(round(churn_rate, 1)),
        "total_revenue": float(round(total_revenue, 2)),
        "trends": {
            "mrr": calc_trend(mrr, mrr),  # MRR trend based on period-over-period
            "arr": calc_trend(mrr * 12, mrr * 12),
            "active_subscriptions": calc_trend(active_subs_count, active_subs_count - new_subs_count + cancelled_count),
            "new_subscriptions": calc_trend(new_subs_count, prev_new_subs_count),
            "churn_rate": float(round(churn_rate - prev_churn_rate, 1)),
            "total_revenue": calc_trend(total_revenue, prev_revenue)
        }
    }


@router.get("/revenue-growth", response_model=List[Dict[str, Any]])
def get_revenue_growth_chart(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
) -> Any:
    """
    Get revenue growth data for the MRR line chart (last 8 months).
    Calculated from actual subscription data grouped by month.
    """
    now = datetime.now(timezone.utc)
    eight_months_ago = now - timedelta(days=240)
    
    # Get monthly revenue from subscriptions created in last 8 months
    monthly_revenue = db.query(
        extract('year', UserSubscription.created_at).label('year'),
        extract('month', UserSubscription.created_at).label('month'),
        func.sum(SubscriptionPlan.price).label('revenue')
    ).join(
        UserSubscription, UserSubscription.plan_id == SubscriptionPlan.id
    ).filter(
        UserSubscription.created_at >= eight_months_ago
    ).group_by(
        extract('year', UserSubscription.created_at),
        extract('month', UserSubscription.created_at)
    ).order_by(
        extract('year', UserSubscription.created_at),
        extract('month', UserSubscription.created_at)
    ).all()

    # Build result for last 8 months
    result = []
    for i in range(7, -1, -1):
        month_date = now - timedelta(days=30 * i)
        month_num = month_date.month
        year_num = month_date.year
        month_name = MONTH_NAMES[month_num - 1]
        
        # Find matching revenue
        revenue = 0
        for row in monthly_revenue:
            if int(row.year) == year_num and int(row.month) == month_num:
                revenue = float(row.revenue)
                break
        
        result.append({"month": month_name, "revenue": revenue})
    
    return result


@router.get("/subscription-growth", response_model=List[Dict[str, Any]])
def get_subscription_growth_chart(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
) -> Any:
    """
    Get subscription growth data (New vs Churned) for the bar chart.
    Calculated from actual subscription data grouped by month.
    """
    now = datetime.now(timezone.utc)
    eight_months_ago = now - timedelta(days=240)
    
    # Get monthly new subscriptions
    monthly_new = db.query(
        extract('year', UserSubscription.created_at).label('year'),
        extract('month', UserSubscription.created_at).label('month'),
        func.count(UserSubscription.id).label('count')
    ).filter(
        UserSubscription.created_at >= eight_months_ago
    ).group_by(
        extract('year', UserSubscription.created_at),
        extract('month', UserSubscription.created_at)
    ).order_by(
        extract('year', UserSubscription.created_at),
        extract('month', UserSubscription.created_at)
    ).all()

    # Get monthly churned subscriptions
    monthly_churned = db.query(
        extract('year', UserSubscription.updated_at).label('year'),
        extract('month', UserSubscription.updated_at).label('month'),
        func.count(UserSubscription.id).label('count')
    ).filter(
        UserSubscription.status == SubscriptionStatus.CANCELLED,
        UserSubscription.updated_at >= eight_months_ago
    ).group_by(
        extract('year', UserSubscription.updated_at),
        extract('month', UserSubscription.updated_at)
    ).order_by(
        extract('year', UserSubscription.updated_at),
        extract('month', UserSubscription.updated_at)
    ).all()

    # Build lookup dicts
    new_lookup = {}
    for row in monthly_new:
        key = (int(row.year), int(row.month))
        new_lookup[key] = row.count

    churned_lookup = {}
    for row in monthly_churned:
        key = (int(row.year), int(row.month))
        churned_lookup[key] = row.count

    # Build result for last 8 months
    result = []
    for i in range(7, -1, -1):
        month_date = now - timedelta(days=30 * i)
        month_num = month_date.month
        year_num = month_date.year
        month_name = MONTH_NAMES[month_num - 1]
        
        key = (year_num, month_num)
        result.append({
            "month": month_name,
            "new": new_lookup.get(key, 0),
            "churned": churned_lookup.get(key, 0)
        })
    
    return result


@router.get("/plan-distribution", response_model=List[Dict[str, Any]])
def get_plan_distribution(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
) -> Any:
    """
    Get distribution of retailers across different plans for the donut chart.
    """
    distribution = db.query(
        SubscriptionPlan.name,
        func.count(UserSubscription.id).label("count")
    ).outerjoin(
        UserSubscription, 
        (UserSubscription.plan_id == SubscriptionPlan.id) & (UserSubscription.status == SubscriptionStatus.ACTIVE)
    ).group_by(SubscriptionPlan.name).all()
    
    total = sum(row.count for row in distribution)
    
    return [
        {
            "plan": row.name,
            "retailers": row.count,
            "percentage": float(round((row.count / total * 100), 1)) if total > 0 else 0
        }
        for row in distribution
    ]
