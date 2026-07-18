from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import stripe
import logging

from app.core.dependencies import get_db, get_current_superuser as get_current_admin
from app.core.config import settings
from app.models.user import User
from app.models.subscription import UserSubscription, SubscriptionPlan, SubscriptionStatus, Payment

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_API_KEY

router = APIRouter()

class CardDetail(BaseModel):
    brand: Optional[str] = None
    last4: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None

class UserSubscriptionDetailResponse(BaseModel):
    plan_name: str
    billing_cycle: Optional[str] = None
    next_billing: Optional[str] = None
    render_used: int
    payment_method: Optional[CardDetail] = None

@router.get("/get-user-detail", response_model=UserSubscriptionDetailResponse, status_code=status.HTTP_200_OK)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)
) -> Any:
    """
    Get user subscription plan, billing cycle, next billing date,
    renders used this month, and Stripe card details. (Admin only)
    """
    
    # 1. Fetch user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )
    
    # 2. Get active or most recent subscription
    from sqlalchemy import or_
    from app.core.timezone import now as tz_now
    from app.services.subscription_service import SubscriptionService
    
    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == user_id,
        UserSubscription.is_queued == False,
        or_(
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= tz_now())
        )
    ).order_by(UserSubscription.created_at.desc()).first()

    subscription = SubscriptionService.check_and_update_subscription_expiry(db, subscription)
    
    if not subscription:
        # Check if they have any subscription record (expired, cancelled, etc.) to get customer_id
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == user_id
        ).order_by(UserSubscription.created_at.desc()).first()

    # 3. Get Stripe Customer ID
    stripe_customer_id = None
    if subscription:
        stripe_customer_id = subscription.stripe_customer_id
    
    if not stripe_customer_id:
        # Fallback to Payment table
        payment = db.query(Payment).filter(Payment.user_id == user_id).first()
        if payment:
            stripe_customer_id = payment.stripe_customer_id

    # 4. Gather subscription and plan info
    plan_name = user.subscription_plan or "No Plan"
    billing_cycle = None
    next_billing = None
    render_used = 0

    if subscription:
        # Fetch plan from DB
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        if plan:
            plan_name = plan.name
            
        # Determine billing cycle
        duration = (subscription.end_date - subscription.start_date).days
        billing_cycle = "yearly" if duration > 31 else "monthly"
        
        # Next billing / renews on date
        if subscription.status == SubscriptionStatus.ACTIVE:
            next_billing = subscription.end_date.isoformat()
            
        # Renders used
        render_used = subscription.used_monthly_renders or 0

    # 5. Fetch payment method (card detail) from Stripe
    payment_method_detail = None
    if stripe_customer_id:
        try:
            # List payment methods of type card for the customer
            pms = stripe.PaymentMethod.list(customer=stripe_customer_id, type="card")
            if pms.data:
                first_card = pms.data[0].card
                payment_method_detail = {
                    "brand": first_card.brand,
                    "last4": first_card.last4,
                    "exp_month": first_card.exp_month,
                    "exp_year": first_card.exp_year
                }
        except Exception as e:
            logger.error(f"Failed to fetch payment method for customer {stripe_customer_id} from Stripe: {e}")

    return {
        "plan_name": plan_name,
        "billing_cycle": billing_cycle,
        "next_billing": next_billing,
        "render_used": render_used,
        "payment_method": payment_method_detail
    }
