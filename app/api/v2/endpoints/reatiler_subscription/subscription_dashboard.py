from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone
import logging
import stripe

from app.core.dependencies import get_db, get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.subscription import UserSubscription, SubscriptionPlan, SubscriptionStatus, Payment

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_API_KEY

router = APIRouter()

@router.get("/subscription-dashboard")
def get_subscription_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get subscription dashboard data for retailer.
    """
    current_user_id = current_user.id

    try:
        # Get user's active subscription
        from sqlalchemy import or_
        from app.services.subscription_service import SubscriptionService
        
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == current_user_id,
            UserSubscription.is_queued == False,
            or_(
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= timezone.utc) if 'timezone' in globals() else (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= datetime.now(timezone.utc))
            )
        ).order_by(UserSubscription.created_at.desc()).first()

        subscription = SubscriptionService.check_and_update_subscription_expiry(db, subscription)

        current_user_stripe_customer_id = subscription.stripe_customer_id if subscription else None
        if not current_user_stripe_customer_id:
            sub = db.query(UserSubscription).filter(UserSubscription.user_id == current_user_id).first()
            if sub:
                current_user_stripe_customer_id = sub.stripe_customer_id
            if not current_user_stripe_customer_id:
                pay = db.query(Payment).filter(Payment.user_id == current_user_id).first()
                if pay:
                    current_user_stripe_customer_id = pay.stripe_customer_id

        # Get subscription plan details
        plan = None
        if subscription:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()

        # Get user's payment methods directly from Stripe (Removed for UI simplification and latency optimization)
        payment_methods = []
        
        dashboard_data = {
            "currentSubscription": None,
            "usageMetrics": {
                "requestsUsed": 0,
                "requestsLimit": 0,
                "remainingRequests": 0,
                "percentageUsed": 0
            },
            "paymentMethods": []
        }
        
        # Add subscription data if exists
        if subscription and plan:
            now = datetime.now(timezone.utc)
            days_remaining = (subscription.end_date - now).days if subscription.end_date > now else 0
            
            dashboard_data["currentSubscription"] = {
                "planName": plan.name,
                "planType": "monthly" if (subscription.end_date - subscription.start_date).days <= 31 else "yearly",
                "status": subscription.status.value,
                "startDate": subscription.start_date.isoformat(),
                "endDate": subscription.end_date.isoformat(),
                "renewsOn": subscription.end_date.isoformat(),
                "price": f"${float(plan.monthly_price or plan.price or 0):.2f}",
                "daysRemaining": days_remaining,
                "stripeCustomerId": subscription.stripe_customer_id,
                "stripeSubscriptionId": subscription.stripe_subscription_id,
                "featurePoints": plan.feature_points
            }
            
            # Real usage metrics using UserSubscription model
            requests_limit = subscription.initial_monthly_renders if subscription.initial_monthly_renders and subscription.initial_monthly_renders != -1 else 999999
            requests_used = subscription.used_monthly_renders or 0

            logger.info(f"User {current_user_id} token usage: {requests_used}/{requests_limit}")

            # Calculate remaining and percentage
            remaining_requests = max(0, requests_limit - requests_used) if requests_limit != 999999 else float('inf')
            percentage_used = min(100, (requests_used / requests_limit * 100)) if requests_limit != 999999 else 0

            dashboard_data["usageMetrics"] = {
                "requestsUsed": requests_used,
                "requestsLimit": requests_limit if requests_limit != 999999 else "Unlimited",
                "remainingRequests": remaining_requests if remaining_requests != float('inf') else "Unlimited",
                "percentageUsed": round(percentage_used, 1)
            }
        
        dashboard_data["paymentMethods"] = payment_methods
        
        return {
            "success": True,
            "data": dashboard_data,
            "lastUpdated": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch subscription dashboard: {str(e)}")
