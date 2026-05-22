from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from datetime import datetime, timedelta, timezone
import uuid
import stripe
import logging

from app.core.dependencies import get_db, get_current_user
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.models.user import User
from app.models.subscription import SubscriptionPlan, UserSubscription, SubscriptionStatus, Payment, PaymentStatus
from app.schemas.subscription import UserSubscription as UserSubscriptionSchema

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_API_KEY

router = APIRouter()

@router.post("/create-checkout-session")
@limiter.limit(settings.RATE_LIMIT_PAYMENT)
def create_checkout_session(
    *,
    request: Request,
    db: Session = Depends(get_db),
    plan_id: uuid.UUID,
    billing_cycle: str = "monthly",
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Create a Stripe checkout session for a plan.
    Ensures Stripe customer exists before checkout.
    """
    current_user_id = current_user.id
    current_user_email = current_user.email
    
    # Query existing stripe customer ID from subscriptions or payments
    current_user_stripe_customer_id = None
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == current_user_id).first()
    if sub:
        current_user_stripe_customer_id = sub.stripe_customer_id
    if not current_user_stripe_customer_id:
        pay = db.query(Payment).filter(Payment.user_id == current_user_id).first()
        if pay:
            current_user_stripe_customer_id = pay.stripe_customer_id

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Subscription plan not found")

    amount = plan.monthly_price if billing_cycle == "monthly" else plan.yearly_price
    if not amount:
        amount = plan.price or 0

    stripe_amount = int(amount * 100)

    try:
        if not current_user_stripe_customer_id:
            logger.info(f"Creating Stripe customer for user: {current_user_id}")
            customer = stripe.Customer.create(
                email=current_user_email,
                metadata={"user_id": str(current_user_id)}
            )
            current_user_stripe_customer_id = customer.id

        stripe_interval = "month" if billing_cycle == "monthly" else "year"
        
        checkout_session = stripe.checkout.Session.create(
            customer=current_user_stripe_customer_id,
            payment_method_types=['card'],
            payment_method_collection='if_required',
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': stripe_amount,
                    'product_data': {
                        'name': plan.name,
                        'description': plan.description or ''
                    },
                    'recurring': {
                        'interval': stripe_interval,
                        'interval_count': 1
                    }
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f"{settings.FRONTEND_URL}/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/payment-failed",
            metadata={
                "user_id": str(current_user_id),
                "plan_id": str(plan.id),
                "billing_cycle": billing_cycle
            }
        )

        # Create a pending payment record
        current_year = datetime.now().year
        invoice_id = f"INV-{current_year}-{str(uuid.uuid4())[:8].upper()}"

        payment = Payment(
            invoice_id=invoice_id,
            user_id=current_user_id,
            plan_id=plan.id,
            amount=amount,
            status=PaymentStatus.PENDING,
            stripe_session_id=checkout_session.id,
            stripe_customer_id=current_user_stripe_customer_id
        )

        db.add(payment)
        db.commit()

        return {"checkout_url": checkout_session.url}
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/verify-payment/{session_id}")
@limiter.limit(settings.RATE_LIMIT_PAYMENT)
def verify_payment(
    request: Request,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Verify payment session status, immediately activating or queuing the user subscription.
    """
    current_user_id = current_user.id
    current_user_stripe_customer_id = None
    sub = db.query(UserSubscription).filter(UserSubscription.user_id == current_user_id).first()
    if sub:
        current_user_stripe_customer_id = sub.stripe_customer_id
    if not current_user_stripe_customer_id:
        pay = db.query(Payment).filter(Payment.user_id == current_user_id).first()
        if pay:
            current_user_stripe_customer_id = pay.stripe_customer_id

    try:
        session = stripe.checkout.Session.retrieve(session_id)

        payment = db.query(Payment).filter(
            Payment.stripe_session_id == session_id,
            Payment.user_id == current_user_id
        ).order_by(Payment.created_at.desc()).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment record not found")

        if session.payment_status == "paid":
            stripe_sub_id = session.get('subscription', '')
            existing_sub = db.query(UserSubscription).filter(
                UserSubscription.stripe_subscription_id == stripe_sub_id
            ).first() if stripe_sub_id else None

            if existing_subscription := existing_sub:
                logger.info("Subscription already exists for this payment, skipping creation")
                return {"status": "success", "message": "Subscription already created"}

            # Update payment status
            if payment.status != PaymentStatus.PAID:
                payment.status = PaymentStatus.PAID
                payment.stripe_payment_intent_id = session.payment_intent

                try:
                    if session.payment_intent:
                        intent = stripe.PaymentIntent.retrieve(session.payment_intent)
                        if intent and intent.payment_method_types:
                            payment.payment_method = intent.payment_method_types[0]
                except Exception:
                    payment.payment_method = "card"

            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == payment.plan_id).first()
            if not plan:
                db.rollback()
                raise HTTPException(status_code=404, detail="Plan not found")

            duration = plan.duration_days or 30

            # Check if user has an active subscription
            active_subscription = db.query(UserSubscription).filter(
                UserSubscription.user_id == payment.user_id,
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                UserSubscription.is_queued == False
            ).order_by(UserSubscription.end_date.desc()).first()

            if active_subscription:
                # Queue the subscription
                start_date = active_subscription.end_date
                end_date = start_date + timedelta(days=duration)

                user_sub = UserSubscription(
                    user_id=payment.user_id,
                    plan_id=payment.plan_id,
                    stripe_customer_id=payment.stripe_customer_id,
                    stripe_subscription_id=stripe_sub_id,
                    start_date=start_date,
                    end_date=end_date,
                    status=SubscriptionStatus.ACTIVE,
                    is_queued=True,
                    activates_after_subscription_id=active_subscription.id,
                    initial_monthly_renders=plan.monthly_renders if plan.monthly_renders != -1 else 999999,
                    used_monthly_renders=0
                )
                logger.info(f"Subscription queued to activate after {active_subscription.id} ends")
            else:
                # Activate immediately
                start_date = datetime.now(timezone.utc)
                end_date = start_date + timedelta(days=duration)

                user_sub = UserSubscription(
                    user_id=payment.user_id,
                    plan_id=payment.plan_id,
                    stripe_customer_id=payment.stripe_customer_id,
                    stripe_subscription_id=stripe_sub_id,
                    start_date=start_date,
                    end_date=end_date,
                    status=SubscriptionStatus.ACTIVE,
                    is_queued=False,
                    initial_monthly_renders=plan.monthly_renders if plan.monthly_renders != -1 else 999999,
                    used_monthly_renders=0
                )

                # Update user's active plan (branding) immediately
                db.query(User).filter(User.id == payment.user_id).update({
                    "subscription_plan": plan.name
                })
                logger.info(f"Subscription activated immediately. Plan: {plan.name}")

            db.add(user_sub)

            db.commit()
            return {"status": "success", "message": "Payment verified and subscription created"}
        
        return {"status": "pending", "message": "Payment not completed yet"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
@limiter.exempt
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Handle Stripe webhooks.
    """
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        event_id = event['id']
        
        logger.info(f"Processing webhook for session: {session['id']}, event_id: {event_id}")
        
        try:
            # Check if we've already processed this webhook event
            existing_payment = db.query(Payment).filter(
                Payment.stripe_session_id == session['id'],
                Payment.stripe_webhook_event_id == event_id
            ).first()
            
            if existing_payment:
                logger.info(f"Webhook event {event_id} already processed")
                return {"status": "success", "message": "Event already processed"}
            
            payment = db.query(Payment).filter(
                Payment.stripe_session_id == session['id']
            ).order_by(Payment.created_at.desc()).first()
            
            if not payment:
                logger.error(f"Payment record not found for session: {session['id']}")
                return {"status": "error", "message": "Payment record not found"}
            
            if payment.status != PaymentStatus.PAID:
                payment.status = PaymentStatus.PAID
                payment.stripe_payment_intent_id = session.get('payment_intent')
                payment.stripe_webhook_event_id = event_id

                if 'payment_method_types' in session and session['payment_method_types']:
                    payment.payment_method = session['payment_method_types'][0]

                db.commit()
                logger.info(f"Payment {payment.id} status updated to PAID via webhook")
            else:
                if not payment.stripe_webhook_event_id:
                    payment.stripe_webhook_event_id = event_id
                    db.commit()
            
        except Exception as e:
            logger.error(f"Error processing webhook: {str(e)}")
            db.rollback()
            return {"status": "error", "message": str(e)}

    return {"status": "success"}


@router.post("/activate-queued-subscriptions")
def activate_queued_subscriptions(
    db: Session = Depends(get_db)
) -> Any:
    """
    Background job to activate queued subscriptions when their parent subscription ends.
    """
    try:
        now = datetime.now(timezone.utc)
        
        queued_subscriptions = db.query(UserSubscription).filter(
            UserSubscription.is_queued == True,
            UserSubscription.status == SubscriptionStatus.ACTIVE
        ).all()
        
        activated_count = 0
        
        for queued_sub in queued_subscriptions:
            if queued_sub.activates_after_subscription_id:
                parent_sub = db.query(UserSubscription).filter(
                    UserSubscription.id == queued_sub.activates_after_subscription_id
                ).first()

                if parent_sub and (parent_sub.end_date < now or parent_sub.status in [SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED]):
                    queued_sub.is_queued = False
                    queued_sub.activates_after_subscription_id = None

                    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == queued_sub.plan_id).first()
                    if plan:
                        # Update user plan tier
                        db.query(User).filter(User.id == queued_sub.user_id).update({
                            "subscription_plan": plan.name
                        })

                        queued_sub.used_monthly_renders = 0
                        queued_sub.initial_monthly_renders = plan.monthly_renders if plan.monthly_renders != -1 else 999999

                        logger.info(f"Activated queued subscription {queued_sub.id} for user {queued_sub.user_id}")
                        activated_count += 1
        
        db.commit()
        return {
            "status": "success",
            "message": f"Activated {activated_count} queued subscriptions",
            "activated_count": activated_count
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error activating queued subscriptions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-monthly-tokens")
def reset_monthly_tokens(
    db: Session = Depends(get_db)
) -> Any:
    """
    Background job to reset monthly tokens for users whose reset date has passed.
    """
    try:
        now = datetime.now(timezone.utc)
        
        # Find all active subscriptions
        active_subs = db.query(UserSubscription).filter(
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            UserSubscription.is_queued == False
        ).all()
        
        reset_count = 0
        
        for sub in active_subs:
            # Check if one month has passed since start_date or created_at
            reset_date = sub.start_date
            if now.month != reset_date.month or now.year != reset_date.year:
                sub.used_monthly_renders = 0
                reset_count += 1
                
        db.commit()
        return {
            "status": "success",
            "message": f"Reset monthly tokens for {reset_count} active subscriptions",
            "reset_count": reset_count
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error resetting monthly tokens: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/token-status")
def get_token_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get current user's token status including used/remaining tokens from their active subscription.
    """
    current_user_id = current_user.id

    try:
        active_sub = db.query(UserSubscription).filter(
            UserSubscription.user_id == current_user_id,
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            UserSubscription.is_queued == False
        ).order_by(UserSubscription.end_date.desc()).first()

        used = active_sub.used_monthly_renders if active_sub else 0
        limit = active_sub.initial_monthly_renders if active_sub else 0
        remaining = max(0, limit - used) if limit != -1 else -1

        plan_name = None
        plan_monthly_renders = None
        if active_sub:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == active_sub.plan_id).first()
            if plan:
                plan_name = plan.name
                plan_monthly_renders = plan.monthly_renders

        return {
            "status": "success",
            "data": {
                "monthly_renders_used": used,
                "monthly_renders_limit": limit,
                "monthly_renders_remaining": remaining,
                "is_unlimited": limit == -1 or limit == 999999,
                "renders_reset_date": active_sub.start_date if active_sub else None,
                "needs_reset": False,
                "active_subscription": {
                    "plan_name": plan_name,
                    "plan_monthly_renders": plan_monthly_renders,
                    "end_date": active_sub.end_date if active_sub else None,
                    "is_queued": active_sub.is_queued if active_sub else False
                } if active_sub else None
            }
        }
    except Exception as e:
        logger.error(f"Error getting token status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-plan", response_model=List[UserSubscriptionSchema])
def get_my_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Get all active and past subscriptions for current retailer.
    """
    subs = db.query(UserSubscription).filter(UserSubscription.user_id == current_user.id).all()
    return subs

