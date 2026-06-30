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

        if user_email != entered_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The email address does not match your account."
            )
            
        generate_and_send_otp(db, current_user, otp_type="cancel_plan")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating or sending OTP for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"API Failure: {str(e)}"
        )

    return {"message": "if mail exists and connected otp is sent"}


@router.get("/cancel/plans", status_code=status.HTTP_200_OK)
def get_smaller_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Retrieve all active subscription plans and mark the user's current active plan.
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

        if subscription:
            subscription = SubscriptionService.check_and_update_subscription_expiry(db, subscription)

        # 2. Query all active plans
        active_plans = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.is_active == True
        ).all()

        # 3. Format plans with current_plan and current_pan flag
        plans_data = []
        for plan in active_plans:
            is_current = False
            if subscription and subscription.plan_id == plan.id:
                is_current = True
            
            plans_data.append({
                "id": str(plan.id),
                "name": plan.name,
                "description": plan.description,
                "price": float(plan.price) if plan.price else None,
                "monthly_price": float(plan.monthly_price) if plan.monthly_price else None,
                "yearly_price": float(plan.yearly_price) if plan.yearly_price else None,
                "duration_days": plan.duration_days,
                "is_active": plan.is_active,
                "is_most_popular": plan.is_most_popular,
                "monthly_renders": plan.monthly_renders,
                "feature_points": plan.feature_points,
                "can_use_logo": plan.can_use_logo,
                "can_use_brand_name": plan.can_use_brand_name,
                "can_use_custom_color": plan.can_use_custom_color,
                "has_unlimited_renders": plan.has_unlimited_renders,
                "created_at": plan.created_at.isoformat() if plan.created_at else None,
                "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
                "current_plan": is_current,
                "current_pan": is_current
            })

        # Sort from highest price to lowest price
        plans_data.sort(key=lambda p: p["monthly_price"] or p["price"] or 0.0, reverse=True)
        return plans_data
    except Exception as e:
        logger.error(f"Error fetching plans for user {current_user.id}: {e}")
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

        # Get current plan details
        current_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()

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

        plan_name = None
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        if plan:
            plan_name = plan.name

        try:
            from app.models.subscription import SubscriptionActivityLog, SubscriptionEventType
            log_entry = SubscriptionActivityLog(
                user_id=current_user.id,
                event_type=SubscriptionEventType.CANCELLED,
                plan_name=plan_name,
                old_plan_name=None,
                triggered_by="Retailer",
                triggered_by_id=current_user.id,
                details=f"Cancelled subscription. Reason: {reason_str}"
            )
            db.add(log_entry)
        except Exception as log_err:
            logger.error(f"Failed to log user subscription cancellation: {log_err}")

        db.commit()
        db.refresh(subscription)

        # Send subscription cancellation confirmation email
        try:
            from app.tasks.email_tasks import send_subscription_cancellation_confirmation_email
            
            user_name = current_user.full_name or current_user.email.split("@")[0]
            plan_name = subscription.plan_name or current_plan.name or "Current Plan"
            access_end_date = subscription.end_date.strftime("%Y-%m-%d") if subscription.end_date else "N/A"
            cancellation_date = subscription.cancellation_date.strftime("%Y-%m-%d") if subscription.cancellation_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
            manage_billing_url = f"{settings.FRONTEND_URL}/retailer/settings" if hasattr(settings, 'FRONTEND_URL') else "#"
            
            send_subscription_cancellation_confirmation_email.delay(
                to=current_user.email,
                user_name=user_name,
                plan_name=plan_name,
                access_end_date=access_end_date,
                cancellation_date=cancellation_date,
                manage_billing_url=manage_billing_url
            )
            logger.info(f"Queued subscription cancellation email for {current_user.email}")
        except Exception as email_err:
            logger.error(f"Failed to queue cancellation email for {current_user.email}: {email_err}")
            # Don't fail the cancellation if email fails
        
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

