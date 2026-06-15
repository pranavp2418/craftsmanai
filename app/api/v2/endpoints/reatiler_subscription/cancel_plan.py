from typing import List, Any
from decimal import Decimal
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.services.otp_service import generate_and_send_otp
from app.schemas.subscription import SubscriptionPlan as SubscriptionPlanSchema
import stripe
from app.core.config import settings
from app.models.subscription import UserSubscription, SubscriptionPlan, SubscriptionStatus, CancellationReason

from datetime import datetime, timezone

logger = logging.getLogger(__name__)

router = APIRouter()

class SendCancelOTPRequest(BaseModel):
    email: EmailStr

@router.post("/cancel/send-otp", status_code=status.HTTP_200_OK)
def send_cancel_otp(
    payload: SendCancelOTPRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Send cancellation OTP to the user's registered email after ownership verification.
    """
    try:
        entered_email = payload.email.strip().lower()
        user_email = current_user.email.strip().lower()

        if user_email == entered_email:
            generate_and_send_otp(db, current_user, otp_type="cancel_plan")
    except Exception as e:
        logger.error(f"Error generating or sending OTP for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API Failure: {str(e)}"
        )

    return {"message": "if mail exists and connected otp is sent"}


@router.get("/cancel/plans", response_model=List[SubscriptionPlanSchema], status_code=status.HTTP_200_OK)
def get_smaller_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Retrieve active subscription plans that are priced lower than the user's current active plan.
    """
    try:
        # 1. Fetch user's active subscription
        from sqlalchemy import or_
        from app.services.subscription_service import SubscriptionService
        
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == current_user.id,
            UserSubscription.is_queued == False,
            or_(
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= datetime.now(timezone.utc))
            )
        ).order_by(UserSubscription.created_at.desc()).first()

        subscription = SubscriptionService.check_and_update_subscription_expiry(db, subscription)

        if not subscription:
            return []

        # 2. Get current plan details
        current_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        if not current_plan:
            return []

        current_price = current_plan.monthly_price or current_plan.price or Decimal("0.0")

        # 3. Query all other active plans
        active_plans = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.is_active == True,
            SubscriptionPlan.id != current_plan.id
        ).all()

        # 4. Filter plans with price less than current price
        smaller_plans = []
        for plan in active_plans:
            plan_price = plan.monthly_price or plan.price or Decimal("0.0")
            if plan_price < current_price:
                smaller_plans.append(plan)

        # Sort from highest price to lowest price
        smaller_plans.sort(key=lambda p: p.monthly_price or p.price or Decimal("0.0"), reverse=True)
        return smaller_plans
    except Exception as e:
        logger.error(f"Error fetching smaller plans for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API Failure: {str(e)}"
        )


class CancelPlanRequest(BaseModel):
    cancellation_reason: str


@router.post("/cancel", status_code=status.HTTP_200_OK)
def cancel_user_plan(
    payload: CancelPlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Cancel the user plan and its recurring payment on Stripe.
    """
    try:
        # Find active user subscription
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == current_user.id,
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            UserSubscription.is_queued == False
        ).order_by(UserSubscription.created_at.desc()).first()

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active subscription found for this user."
            )

        # Cancel on Stripe if there is a stripe_subscription_id
        if subscription.stripe_subscription_id:
            try:
                stripe.api_key = settings.STRIPE_API_KEY
                stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    cancel_at_period_end=True
                )
            except Exception as stripe_err:
                logger.error(f"Stripe cancel subscription failed for {subscription.stripe_subscription_id}: {stripe_err}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stripe cancellation failed: {str(stripe_err)}"
                )

        # Map cancellation reason string to CancellationReason enum
        reason_str = payload.cancellation_reason.strip()
        reason_enum = None
        for reason in CancellationReason:
            if reason.value.lower() == reason_str.lower():
                reason_enum = reason
                break
        if not reason_enum:
            reason_enum = CancellationReason.OTHER

        from datetime import datetime, timezone
        subscription.status = SubscriptionStatus.CANCELLED
        subscription.cancellation_reason = reason_enum
        subscription.cancellation_date = datetime.now(timezone.utc)

        db.commit()
        db.refresh(subscription)

        return {
            "success": True,
            "message": "Subscription cancelled successfully",
            "subscription_id": str(subscription.id),
            "status": subscription.status
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling subscription for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API Failure: {str(e)}"
        )

