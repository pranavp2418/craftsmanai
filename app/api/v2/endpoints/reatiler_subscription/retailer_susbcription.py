from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, update
from datetime import datetime, timedelta, timezone
import uuid
import stripe
import logging
from typing import Optional
from app.core.dependencies import get_db, get_current_user, get_current_active_user
from app.core.config import settings
from app.core.rate_limiter import limiter
from app.models.user import User
from app.models.subscription import SubscriptionPlan, UserSubscription, SubscriptionStatus, Payment, PaymentStatus, CancellationReason
from app.schemas.subscription import UserSubscription as UserSubscriptionSchema
from app.services.invoice_service import generate_and_store_invoice
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_API_KEY

def create_invoice_for_payment(db: Session, payment: Payment) -> None:
    """
    Wrapper function that calls the centralized invoice generation service.
    """
    # Ensure full user/plan relationship models are eager-loaded for PDF generation
    from sqlalchemy.orm import selectinload
    payment_query = db.query(Payment).options(
        selectinload(Payment.user),
        selectinload(Payment.plan)
    ).filter(Payment.id == payment.id).first()
    
    target_payment = payment_query or payment
    generate_and_store_invoice(db, target_payment)

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

    if amount == 0:
        # Check if user has had any subscription before (active, expired, trial, anything)
        has_any_sub = db.query(UserSubscription).filter(UserSubscription.user_id == current_user_id).first()
        if has_any_sub:
            raise HTTPException(
                status_code=400,
                detail="Free or trial plan is only available for first-time subscribers and can only be used once."
            )

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


@router.post("/create-topup-checkout-session")
@limiter.limit(settings.RATE_LIMIT_PAYMENT)
def create_topup_checkout_session(
    *,
    request: Request,
    db: Session = Depends(get_db),
    topup_pack_id: uuid.UUID,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Create a Stripe checkout session for a topup pack.
    Requires the user to have a current active subscription.
    """
    from app.models.subscription import TopupPack

    current_user_id = current_user.id
    current_user_email = current_user.email

    # 1. Verify that user has an active subscription
    active_subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == current_user_id,
        UserSubscription.status == SubscriptionStatus.ACTIVE,
        UserSubscription.is_queued == False
    ).order_by(UserSubscription.end_date.desc()).first()

    if not active_subscription:
        raise HTTPException(
            status_code=400,
            detail="You must have an active subscription to purchase a top-up pack."
        )

    # 2. Get the topup pack details
    topup_pack = db.query(TopupPack).filter(TopupPack.id == topup_pack_id).first()
    if not topup_pack:
        raise HTTPException(status_code=404, detail="Topup pack not found")

    if not topup_pack.is_active:
        raise HTTPException(status_code=400, detail="This topup pack is not currently active")

    stripe_customer_id = active_subscription.stripe_customer_id
    if not stripe_customer_id:
        pay = db.query(Payment).filter(Payment.user_id == current_user_id).first()
        if pay:
            stripe_customer_id = pay.stripe_customer_id

    if not stripe_customer_id:
        logger.info(f"Creating Stripe customer for user: {current_user_id}")
        customer = stripe.Customer.create(
            email=current_user_email,
            metadata={"user_id": str(current_user_id)}
        )
        stripe_customer_id = customer.id
        active_subscription.stripe_customer_id = stripe_customer_id
        db.commit()

    stripe_amount = int(topup_pack.price * 100)

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=['card'],
            payment_method_collection='if_required',
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': stripe_amount,
                    'product_data': {
                        'name': f"Topup Pack - {topup_pack.renders} Renders",
                        'description': f"Adds recurring {topup_pack.renders} renders to your monthly subscription allowance."
                    },
                    'recurring': {
                        'interval': 'month',
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
                "topup_pack_id": str(topup_pack.id),
                "is_topup": "true"
            }
        )

        # Create a pending payment record
        current_year = datetime.now().year
        invoice_id = f"INV-{current_year}-{str(uuid.uuid4())[:8].upper()}"

        payment = Payment(
            invoice_id=invoice_id,
            user_id=current_user_id,
            plan_id=None,
            topup_pack_id=topup_pack.id,
            amount=topup_pack.price,
            status=PaymentStatus.PENDING,
            stripe_session_id=checkout_session.id,
            stripe_customer_id=stripe_customer_id
        )

        db.add(payment)
        db.commit()

        return {"checkout_url": checkout_session.url}
    except Exception as e:
        logger.error(f"Error creating topup checkout session: {str(e)}", exc_info=True)
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

        if session.payment_status in ["paid", "no_payment_required"]:
            stripe_sub_id = getattr(session, 'subscription', '') or ''

            # Check if this is a topup checkout session
            is_topup = payment.topup_pack_id is not None
            if is_topup:
                if payment.status != PaymentStatus.PAID:
                    payment.status = PaymentStatus.PAID
                    payment.stripe_payment_intent_id = getattr(session, 'payment_intent', None) or session_id
                    payment.payment_method = "card"
                    
                    active_sub = db.query(UserSubscription).filter(
                        UserSubscription.user_id == payment.user_id,
                        UserSubscription.status == SubscriptionStatus.ACTIVE,
                        UserSubscription.is_queued == False
                    ).first()
                    
                    if active_sub:
                        from app.models.subscription import TopupPack
                        topup_pack = db.query(TopupPack).filter(TopupPack.id == payment.topup_pack_id).first()
                        if topup_pack:
                            active_sub.topup_plan_id = topup_pack.id
                            active_sub.renders_added = (active_sub.renders_added or 0) + topup_pack.renders
                            active_sub.initial_monthly_renders += topup_pack.renders
                            
                            # Update active_topups JSON list - append each purchase as a separate entry
                            current_topups = list(active_sub.active_topups or [])
                            new_entry = {
                                "topup_pack_id": str(topup_pack.id),
                                "stripe_subscription_ids": [stripe_sub_id] if stripe_sub_id else [],
                                "renders": topup_pack.renders,
                                "status": "active"
                            }
                            current_topups.append(new_entry)
                            active_sub.active_topups = current_topups

                            # Relational table sync
                            from app.models.subscription import UserTopup
                            user_topup = UserTopup(
                                user_id=active_sub.user_id,
                                user_subscription_id=active_sub.id,
                                topup_pack_id=topup_pack.id,
                                stripe_subscription_id=stripe_sub_id,
                                status="active",
                                renders=topup_pack.renders,
                                price=topup_pack.price
                            )
                            db.add(user_topup)
                    
                    db.commit()
                
                # Send top-up purchase confirmation email
                try:
                    from app.tasks.email_tasks import send_topup_purchase_confirmation_email
                    retailer_user = db.query(User).filter(User.id == payment.user_id).first()
                    if retailer_user:
                        user_name = retailer_user.full_name or retailer_user.email.split("@")[0]
                        from app.models.subscription import TopupPack
                        topup_pack = db.query(TopupPack).filter(TopupPack.id == payment.topup_pack_id).first()
                        plan_name = f"Topup Pack - {topup_pack.renders} Renders" if topup_pack else "Topup Pack"
                        formatted_amount = f"${float(payment.amount):.2f}" if payment.amount else "$0.00"
                        billing_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
                        billing_url = f"{settings.FRONTEND_URL}/retailer/settings" if hasattr(settings, "FRONTEND_URL") else "#"
                        
                        send_topup_purchase_confirmation_email.delay(
                            to=retailer_user.email,
                            user_name=user_name,
                            plan_name=plan_name,
                            amount=formatted_amount,
                            billing_date=billing_date,
                            billing_url=billing_url
                        )
                        logger.info(f"Queued top-up purchase confirmation email for {retailer_user.email}")
                except Exception as email_err:
                    logger.error(f"Failed to queue top-up purchase confirmation email: {str(email_err)}")
                
                from app.models.subscription import TopupPack
                topup_pack = db.query(TopupPack).filter(TopupPack.id == payment.topup_pack_id).first()
                renders_count = topup_pack.renders if topup_pack else 0
                return {
                    "status": "success",
                    "message": "Topup pack successfully purchased and activated",
                    "amount": float(payment.amount) if payment.amount else 0.0,
                    "payment_method": payment.payment_method or "card",
                    "transaction_id": payment.stripe_payment_intent_id or session_id,
                    "plan_name": f"Topup Pack - {renders_count} Renders"
                }

            existing_sub = db.query(UserSubscription).filter(
                UserSubscription.stripe_subscription_id == stripe_sub_id
            ).first() if stripe_sub_id else None

            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == payment.plan_id).first()
            plan_name = plan.name if plan else "Unknown Plan"

            if existing_subscription := existing_sub:
                logger.info("Subscription already exists for this payment, skipping creation")
                return {
                    "status": "success",
                    "message": "Subscription already created",
                    "amount": float(payment.amount) if payment.amount else 0.0,
                    "payment_method": payment.payment_method or "card",
                    "transaction_id": payment.stripe_payment_intent_id or getattr(session, 'payment_intent', None) or session_id,
                    "plan_name": plan_name
                }

            # Retrieve payment intent & payment method safely (handles both subscription and payment modes)
            payment_intent_id = getattr(session, 'payment_intent', None)
            payment_method = "card"

            if not payment_intent_id and getattr(session, 'invoice', None):
                try:
                    invoice_id = session.invoice
                    invoice = stripe.Invoice.retrieve(invoice_id, expand=['payments.data.payment.payment_intent'])
                    if getattr(invoice, 'payments', None) and invoice.payments.data:
                        payment_item = invoice.payments.data[0]
                        payment_obj = getattr(payment_item, 'payment', None)
                        if payment_obj:
                            pi_obj = getattr(payment_obj, 'payment_intent', None)
                            if pi_obj:
                                payment_intent_id = pi_obj.id
                                if pi_obj.payment_method:
                                    try:
                                        pm = stripe.PaymentMethod.retrieve(pi_obj.payment_method)
                                        payment_method = pm.card.brand if (pm and pm.card) else getattr(pm, 'type', 'card')
                                    except Exception:
                                        payment_method = "card"
                except Exception as e:
                    logger.error(f"Error retrieving subscription payment details from invoice: {e}")

            # Update payment status
            if payment.status != PaymentStatus.PAID:
                payment.status = PaymentStatus.PAID
                payment.stripe_payment_intent_id = payment_intent_id
                payment.payment_method = payment_method
                create_invoice_for_payment(db, payment)

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

            is_active_sub_free = False
            if active_subscription:
                active_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == active_subscription.plan_id).first()
                if active_plan:
                    if (active_plan.monthly_price == 0 or active_plan.yearly_price == 0 or (active_plan.price or 0) == 0):
                        is_active_sub_free = True

            is_queued = False
            activates_after_id = None
            start_date = datetime.now(timezone.utc)
            end_date = start_date + timedelta(days=duration)

            if active_subscription:
                # Deactivate the old active subscription immediately
                active_subscription.status = SubscriptionStatus.EXPIRED
                active_subscription.end_date = datetime.now(timezone.utc)
                
                # Cancel the old subscription on Stripe immediately to avoid double-charging
                if active_subscription.stripe_subscription_id:
                    try:
                        logger.info(f"Cancelling old stripe subscription immediately: {active_subscription.stripe_subscription_id}")
                        stripe.Subscription.delete(active_subscription.stripe_subscription_id)
                    except Exception as e:
                        logger.error(f"Error deleting old stripe subscription: {e}")
                        
                # Also cancel all active top-ups on Stripe immediately to avoid double-charging
                from app.models.subscription import UserTopup
                db_topups = db.query(UserTopup).filter(
                    UserTopup.user_subscription_id == active_subscription.id,
                    UserTopup.status == "active"
                ).all()
                
                stripe_sub_ids = []
                if db_topups:
                    for t in db_topups:
                        if t.stripe_subscription_id:
                            stripe_sub_ids.append(t.stripe_subscription_id)
                else:
                    # Fallback to active_topups JSON list for legacy subscriptions
                    if active_subscription.active_topups:
                        for topup_entry in active_subscription.active_topups:
                            for sub_id in topup_entry.get("stripe_subscription_ids", []):
                                if sub_id:
                                    stripe_sub_ids.append(sub_id)
                                    
                for sub_id in stripe_sub_ids:
                    try:
                        logger.info(f"Cancelling top-up stripe subscription immediately: {sub_id}")
                        stripe.Subscription.delete(sub_id)
                    except Exception as topup_err:
                        logger.error(f"Failed to delete top-up subscription {sub_id} on Stripe: {topup_err}")
                                
                logger.info(f"Previous active subscription {active_subscription.id} marked as EXPIRED")

            user_sub = UserSubscription(
                user_id=payment.user_id,
                plan_id=payment.plan_id,
                stripe_customer_id=payment.stripe_customer_id,
                stripe_subscription_id=stripe_sub_id,
                start_date=start_date,
                end_date=end_date,
                status=SubscriptionStatus.ACTIVE,
                is_queued=is_queued,
                activates_after_subscription_id=activates_after_id,
                initial_monthly_renders=plan.monthly_renders if plan.monthly_renders != -1 else 999999,
                used_monthly_renders=0
            )

            # Update user's active plan (branding) immediately only if NOT queued
            if not is_queued:
                db.query(User).filter(User.id == payment.user_id).update({
                    "subscription_plan": plan.name
                })
                logger.info(f"Subscription activated immediately. Plan: {plan.name}")
            else:
                logger.info(f"Subscription queued. Plan: {plan.name}")

            db.add(user_sub)

            # Create subscription activity log
            try:
                from app.models.subscription import SubscriptionActivityLog, SubscriptionEventType
                
                # Determine event type
                event_type = SubscriptionEventType.CREATED
                old_plan_name = None
                
                # Find old plan if there was an active subscription
                if active_subscription:
                    old_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == active_subscription.plan_id).first()
                    if old_plan:
                        old_plan_name = old_plan.name
                        old_price = old_plan.monthly_price if old_plan.monthly_price is not None else (old_plan.price or 0)
                        new_price = plan.monthly_price if plan.monthly_price is not None else (plan.price or 0)
                        if new_price > old_price:
                            event_type = SubscriptionEventType.UPGRADED
                        elif new_price < old_price:
                            event_type = SubscriptionEventType.DOWNGRADED
                        else:
                            event_type = SubscriptionEventType.UPGRADED
                
                log_entry = SubscriptionActivityLog(
                    user_id=payment.user_id,
                    event_type=event_type,
                    plan_name=plan.name,
                    old_plan_name=old_plan_name,
                    triggered_by="Retailer",
                    triggered_by_id=payment.user_id,
                    details=f"Subscription processed via verification. Status: {user_sub.status}. Queued: {is_queued}."
                )
                db.add(log_entry)
                logger.info(f"SubscriptionActivityLog added for user {payment.user_id}: {event_type}")
            except Exception as log_err:
                logger.error(f"Failed to create subscription activity log: {log_err}")

            db.commit()

            # Send in-app notifications
            try:
                notification_service = NotificationService(db)
                retailer_user = db.query(User).filter(User.id == payment.user_id).first()
                if retailer_user:
                    # Notify retailer
                    notification_service.send_notification(
                        user_id=retailer_user.id,
                        type="subscription",
                        title="Subscription Successful",
                        message=f"You have successfully subscribed to the {plan.name} plan.",
                        source="subscription",
                        reference_id=retailer_user.id,
                        data={
                            "plan_name": plan.name,
                            "amount": float(payment.amount) if payment.amount else 0.0,
                        }
                    )
                    
                    # Send plan purchase confirmation email
                    try:
                        from app.tasks.email_tasks import send_plan_purchase_confirmation_email
                        user_name = retailer_user.full_name or retailer_user.email.split("@")[0]
                        plan_name = plan.name
                        formatted_amount = f"${float(payment.amount):.2f}" if payment.amount else "$0.00"
                        billing_date = user_sub.start_date.strftime("%B %d, %Y") if user_sub.start_date else datetime.now(timezone.utc).strftime("%B %d, %Y")
                        billing_url = f"{settings.FRONTEND_URL}/retailer/settings" if hasattr(settings, "FRONTEND_URL") else "#"
                        
                        send_plan_purchase_confirmation_email.delay(
                            to=retailer_user.email,
                            user_name=user_name,
                            plan_name=plan_name,
                            amount=formatted_amount,
                            billing_date=billing_date,
                            billing_url=billing_url
                        )
                        logger.info(f"Queued plan purchase confirmation email for {retailer_user.email}")
                    except Exception as email_err:
                        logger.error(f"Failed to queue plan purchase confirmation email: {str(email_err)}")
                    
                    # Notify admins
                    admins = db.query(User).filter(User.is_superuser == True).all()
                    for admin in admins:
                        notification_service.send_notification(
                            user_id=admin.id,
                            type="subscription",
                            title="New Subscription Purchased",
                            message=f"Retailer {retailer_user.full_name or retailer_user.email} has successfully subscribed to the {plan.name} plan.",
                            source="subscription",
                            reference_id=retailer_user.id,
                            data={
                                "retailer_id": retailer_user.id,
                                "retailer_name": retailer_user.full_name or retailer_user.email,
                                "plan_name": plan.name,
                                "amount": float(payment.amount) if payment.amount else 0.0,
                            }
                        )
            except Exception as e:
                logger.error(f"Failed to send subscription notifications: {str(e)}", exc_info=True)

            return {
                "status": "success",
                "message": "Payment verified and subscription created",
                "amount": float(payment.amount) if payment.amount else 0.0,
                "payment_method": payment.payment_method or "card",
                "transaction_id": payment.stripe_payment_intent_id or getattr(session, 'payment_intent', None) or session_id,
                "plan_name": plan_name
            }
        
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
                
                # Retrieve payment intent & payment method safely (handles both subscription and payment modes)
                payment_intent_id = getattr(session, 'payment_intent', None)
                payment_method = "card"

                # If subscription mode, retrieve from invoice
                invoice_id = getattr(session, 'invoice', None) or (session.get('invoice') if hasattr(session, 'get') else None)
                if not payment_intent_id and invoice_id:
                    try:
                        invoice = stripe.Invoice.retrieve(invoice_id, expand=['payments.data.payment.payment_intent'])
                        if getattr(invoice, 'payments', None) and invoice.payments.data:
                            payment_item = invoice.payments.data[0]
                            payment_obj = getattr(payment_item, 'payment', None)
                            if payment_obj:
                                pi_obj = getattr(payment_obj, 'payment_intent', None)
                                if pi_obj:
                                    payment_intent_id = pi_obj.id
                                    if pi_obj.payment_method:
                                        try:
                                            pm = stripe.PaymentMethod.retrieve(pi_obj.payment_method)
                                            payment_method = pm.card.brand if (pm and pm.card) else getattr(pm, 'type', 'card')
                                        except Exception:
                                            payment_method = "card"
                    except Exception as e:
                        logger.error(f"Error retrieving subscription payment details from invoice in webhook: {e}")

                payment.stripe_payment_intent_id = payment_intent_id
                payment.payment_method = payment_method
                payment.stripe_webhook_event_id = event_id
                create_invoice_for_payment(db, payment)

                if payment.topup_pack_id:
                    active_sub = db.query(UserSubscription).filter(
                        UserSubscription.user_id == payment.user_id,
                        UserSubscription.status == SubscriptionStatus.ACTIVE,
                        UserSubscription.is_queued == False
                    ).first()
                    if active_sub:
                        from app.models.subscription import TopupPack
                        topup_pack = db.query(TopupPack).filter(TopupPack.id == payment.topup_pack_id).first()
                        if topup_pack:
                            active_sub.topup_plan_id = topup_pack.id
                            active_sub.renders_added = (active_sub.renders_added or 0) + topup_pack.renders
                            active_sub.initial_monthly_renders += topup_pack.renders
                            
                            # Update active_topups JSON list - append each purchase as a separate entry
                            stripe_sub_id = session.get('subscription')
                            current_topups = list(active_sub.active_topups or [])
                            new_entry = {
                                "topup_pack_id": str(topup_pack.id),
                                "stripe_subscription_ids": [stripe_sub_id] if stripe_sub_id else [],
                                "renders": topup_pack.renders,
                                "status": "active"
                            }
                            current_topups.append(new_entry)
                            active_sub.active_topups = current_topups
                            
                    # Send top-up purchase confirmation email via webhook
                    try:
                        from app.tasks.email_tasks import send_topup_purchase_confirmation_email
                        from app.models.user import User
                        retailer_user = db.query(User).filter(User.id == payment.user_id).first()
                        if retailer_user:
                            user_name = retailer_user.full_name or retailer_user.email.split("@")[0]
                            from app.models.subscription import TopupPack
                            topup_pack = db.query(TopupPack).filter(TopupPack.id == payment.topup_pack_id).first()
                            plan_name = f"Topup Pack - {topup_pack.renders} Renders" if topup_pack else "Topup Pack"
                            formatted_amount = f"${float(payment.amount):.2f}" if payment.amount else "$0.00"
                            billing_date = datetime.now(timezone.utc).strftime("%B %d, %Y")
                            billing_url = f"{settings.FRONTEND_URL}/retailer/settings" if hasattr(settings, "FRONTEND_URL") else "#"
                            
                            send_topup_purchase_confirmation_email.delay(
                                to=retailer_user.email,
                                user_name=user_name,
                                plan_name=plan_name,
                                amount=formatted_amount,
                                billing_date=billing_date,
                                billing_url=billing_url
                            )
                            logger.info(f"Queued top-up purchase confirmation email via webhook for {retailer_user.email}")
                    except Exception as email_err:
                        logger.error(f"Failed to queue top-up purchase confirmation email in webhook: {str(email_err)}")

                            # Relational table sync
                            from app.models.subscription import UserTopup
                            user_topup = UserTopup(
                                user_id=active_sub.user_id,
                                user_subscription_id=active_sub.id,
                                topup_pack_id=topup_pack.id,
                                stripe_subscription_id=stripe_sub_id,
                                status="active",
                                renders=topup_pack.renders,
                                price=topup_pack.price
                            )
                            db.add(user_topup)

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

    elif event['type'] == 'customer.subscription.deleted':
        stripe_sub = event['data']['object']
        stripe_sub_id = stripe_sub['id']
        try:
            sub = db.query(UserSubscription).filter(
                UserSubscription.stripe_subscription_id == stripe_sub_id
            ).first()
            if sub:
                sub.status = SubscriptionStatus.CANCELLED
                
                # Log to activity log
                try:
                    from app.models.subscription import SubscriptionActivityLog, SubscriptionEventType
                    plan_name = None
                    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
                    if plan:
                        plan_name = plan.name
                    log_entry = SubscriptionActivityLog(
                        user_id=sub.user_id,
                        event_type=SubscriptionEventType.CANCELLED,
                        plan_name=plan_name,
                        old_plan_name=None,
                        triggered_by="System",
                        triggered_by_id=None,
                        details="Subscription deleted/cancelled via Stripe Webhook."
                    )
                    db.add(log_entry)
                except Exception as log_err:
                    logger.error(f"Failed to create cancellation log in webhook: {log_err}")

                db.commit()
                logger.info(f"Subscription {sub.id} marked as CANCELLED via customer.subscription.deleted webhook")
            else:
                # Check if it is a top-up subscription
                from app.models.subscription import UserTopup
                topup = db.query(UserTopup).filter(
                    UserTopup.stripe_subscription_id == stripe_sub_id
                ).first()
                if topup:
                    topup.status = "cancelled"
                    parent_sub = topup.subscription
                    if parent_sub:
                        parent_sub.renders_added = max(0, (parent_sub.renders_added or 0) - topup.renders)
                        parent_sub.initial_monthly_renders = max(0, (parent_sub.initial_monthly_renders or 0) - topup.renders)
                        
                        current_topups = list(parent_sub.active_topups or [])
                        updated_topups = []
                        for entry in current_topups:
                            if entry.get("topup_pack_id") == str(topup.topup_pack_id) and stripe_sub_id in entry.get("stripe_subscription_ids", []):
                                entry["status"] = "cancelled"
                            updated_topups.append(entry)
                        parent_sub.active_topups = updated_topups
                    db.commit()
                    logger.info(f"Top-up subscription {stripe_sub_id} marked as cancelled via webhook")
                
                # Send subscription cancellation confirmation email
                try:
                    from app.tasks.email_tasks import send_subscription_cancellation_confirmation_email
                    user = db.query(User).filter(User.id == sub.user_id).first()
                    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
                    if user and plan:
                        user_name = user.full_name or user.email.split("@")[0]
                        plan_name = plan.name
                        access_end_date = sub.end_date.strftime("%Y-%m-%d") if sub.end_date else "N/A"
                        cancellation_date = sub.cancellation_date.strftime("%Y-%m-%d") if sub.cancellation_date else datetime.now(timezone.utc).strftime("%Y-%m-%d")
                        manage_billing_url = f"{settings.FRONTEND_URL}/retailer" if hasattr(settings, 'FRONTEND_URL') else "#"
                        
                        send_subscription_cancellation_confirmation_email.delay(
                            to=user.email,
                            user_name=user_name,
                            plan_name=plan_name,
                            access_end_date=access_end_date,
                            cancellation_date=cancellation_date,
                            manage_billing_url=manage_billing_url
                        )
                        logger.info(f"Queued subscription cancellation email via webhook for {user.email}")
                except Exception as email_err:
                    logger.error(f"Failed to queue subscription cancellation email in webhook: {email_err}")
        except Exception as e:
            logger.error(f"Error processing customer.subscription.deleted webhook: {str(e)}")
            db.rollback()
            return {"status": "error", "message": str(e)}

    elif event['type'] == 'customer.subscription.updated':
        stripe_sub = event['data']['object']
        stripe_sub_id = stripe_sub['id']
        try:
            sub = db.query(UserSubscription).filter(
                UserSubscription.stripe_subscription_id == stripe_sub_id
            ).first()
            if sub:
                if stripe_sub.get('cancel_at_period_end'):
                    if not sub.cancellation_date:
                        sub.cancellation_date = datetime.now(timezone.utc)
                        sub.cancellation_reason = CancellationReason.OTHER
                
                stripe_status = stripe_sub.get('status')
                old_status = sub.status
                if stripe_status == 'canceled':
                    sub.status = SubscriptionStatus.CANCELLED
                elif stripe_status in ['unpaid', 'incomplete_expired']:
                    sub.status = SubscriptionStatus.EXPIRED
                
                # Log to activity log if status changed to CANCELLED or EXPIRED
                if sub.status != old_status and sub.status in [SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED]:
                    try:
                        from app.models.subscription import SubscriptionActivityLog, SubscriptionEventType
                        plan_name = None
                        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
                        if plan:
                            plan_name = plan.name
                        log_entry = SubscriptionActivityLog(
                            user_id=sub.user_id,
                            event_type=SubscriptionEventType.CANCELLED,
                            plan_name=plan_name,
                            old_plan_name=None,
                            triggered_by="System",
                            triggered_by_id=None,
                            details=f"Subscription updated to {sub.status} via Stripe Webhook (status in Stripe was {stripe_status})."
                        )
                        db.add(log_entry)
                    except Exception as log_err:
                        logger.error(f"Failed to create cancellation/expiry log in webhook update: {log_err}")

                db.commit()
                logger.info(f"Subscription {sub.id} updated via customer.subscription.updated webhook")
        except Exception as e:
            logger.error(f"Error processing customer.subscription.updated webhook: {str(e)}")
            db.rollback()
            return {"status": "error", "message": str(e)}

    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        stripe_sub_id = invoice.get('subscription')
        
        # Only care about subscription cycle renewals
        if stripe_sub_id and invoice.get('billing_reason') == 'subscription_cycle':
            logger.info(f"Processing renewal for subscription: {stripe_sub_id}")
            try:
                sub = db.query(UserSubscription).filter(
                    UserSubscription.stripe_subscription_id == stripe_sub_id
                ).first()
                if sub:
                    user = db.query(User).filter(User.id == sub.user_id).first()
                    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == sub.plan_id).first()
                    if user and plan:
                        user_name = user.full_name or user.email.split("@")[0]
                        plan_name = plan.name
                        
                        amount_val = invoice.get('amount_paid', 0) / 100.0
                        formatted_amount = f"${amount_val:.2f}"
                        
                        lines = invoice.get('lines', {}).get('data', [])
                        next_renewal = None
                        if lines:
                            next_renewal_ts = lines[0].get('period', {}).get('end')
                            if next_renewal_ts:
                                next_renewal = datetime.fromtimestamp(next_renewal_ts, timezone.utc).strftime("%B %d, %Y")
                        
                        if not next_renewal:
                            next_renewal = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%B %d, %Y")
                            
                        invoice_url = invoice.get('hosted_invoice_url') or f"{settings.FRONTEND_URL}/retailer/settings"
                        
                        from app.tasks.email_tasks import send_subscription_renewal_confirmation_email
                        send_subscription_renewal_confirmation_email.delay(
                            to=user.email,
                            user_name=user_name,
                            plan_name=plan_name,
                            amount=formatted_amount,
                            next_renewal_date=next_renewal,
                            invoice_url=invoice_url
                        )
                        logger.info(f"Queued subscription renewal email for {user.email}")
            except Exception as e:
                logger.error(f"Error handling invoice.payment_succeeded: {str(e)}")

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

                        # Log to activity log
                        try:
                            from app.models.subscription import SubscriptionActivityLog, SubscriptionEventType
                            parent_plan_name = None
                            if parent_sub:
                                parent_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == parent_sub.plan_id).first()
                                if parent_plan:
                                    parent_plan_name = parent_plan.name
                            log_entry = SubscriptionActivityLog(
                                user_id=queued_sub.user_id,
                                event_type=SubscriptionEventType.CREATED,
                                plan_name=plan.name,
                                old_plan_name=parent_plan_name,
                                triggered_by="System",
                                triggered_by_id=None,
                                details="Queued subscription activated automatically by the system."
                            )
                            db.add(log_entry)
                        except Exception as log_err:
                            logger.error(f"Failed to create activation log in background job: {log_err}")

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
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    Get current user's token status including used/remaining tokens from their active subscription.
    """
    current_user_id = current_user.id

    try:
        from sqlalchemy import or_
        from app.services.subscription_service import SubscriptionService
        
        now = datetime.now(timezone.utc)
        
        active_sub = db.query(UserSubscription).filter(
            UserSubscription.user_id == current_user_id,
            UserSubscription.is_queued == False,
            or_(
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
            )
        ).order_by(UserSubscription.end_date.desc()).first()

        active_sub = SubscriptionService.check_and_update_subscription_expiry(db, active_sub)

        used = active_sub.used_monthly_renders if active_sub else 0
        limit = active_sub.initial_monthly_renders if active_sub else 0
        remaining = max(0, limit - used) if limit != -1 else -1

        plan_name = None
        plan_monthly_renders = None
        can_use_logo = None
        can_use_brand_name = None
        has_unlimited_renders = None
        topup_renders = active_sub.renders_added if (active_sub and active_sub.renders_added is not None) else 0
        if limit in [-1, 999999]:
            base_limit = limit
        else:
            base_limit = max(0, limit - topup_renders)

        if active_sub:
            plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == active_sub.plan_id).first()
            if plan:
                plan_name = plan.name
                plan_monthly_renders = plan.monthly_renders
                can_use_logo = plan.can_use_logo
                can_use_brand_name = plan.can_use_brand_name
                can_use_custom_color = plan.can_use_custom_color
                has_unlimited_renders = plan.has_unlimited_renders

        return {
            "status": "success",
            "data": {
                "monthly_renders_used": used,
                "monthly_renders_limit": base_limit,
                "topup_renders": topup_renders,
                "monthly_renders_remaining": remaining,
                "is_unlimited": limit == -1 or limit == 999999 or has_unlimited_renders,
                "renders_reset_date": active_sub.start_date if active_sub else None,
                "needs_reset": False,
                "active_subscription": {
                    "plan_name": plan_name,
                    "plan_monthly_renders": plan_monthly_renders,
                    "end_date": active_sub.end_date if active_sub else None,
                    "is_queued": active_sub.is_queued if active_sub else False,
                    "can_use_logo": can_use_logo,
                    "can_use_brand_name": can_use_brand_name,
                    "can_use_custom_color": can_use_custom_color,
                    "has_unlimited_renders": has_unlimited_renders
                } if active_sub else None
            }
        }
    except Exception as e:
        logger.error(f"Error getting token status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-plan", response_model=List[UserSubscriptionSchema])
def get_my_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    Get the current active subscription for current retailer.
    """
    from sqlalchemy import or_
    from sqlalchemy.orm import joinedload
    now = datetime.now(timezone.utc)
    sub = db.query(UserSubscription).filter(
        UserSubscription.user_id == current_user.id,
        UserSubscription.is_queued == False,
        or_(
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
        )
    ).options(joinedload(UserSubscription.plan)).order_by(UserSubscription.end_date.desc()).first()
    return [sub] if sub else []

