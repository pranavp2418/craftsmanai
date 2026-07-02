import logging
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.subscription import UserSubscription, SubscriptionStatus

from sqlalchemy import or_
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class SubscriptionService:
    @staticmethod
    def get_subscription_owner_id(user: User) -> int:
        """Get the ID of the user who owns the subscription (workspace owner)."""
        if user.is_team_member and user.team_owner_id:
            return user.team_owner_id
        return user.id

    @staticmethod
    def check_and_update_subscription_expiry(db: Session, subscription: Optional[UserSubscription]) -> Optional[UserSubscription]:
        if not subscription:
            return None
        now = datetime.now(timezone.utc)
        if subscription.end_date < now:
            if subscription.status == SubscriptionStatus.ACTIVE:
                subscription.status = SubscriptionStatus.EXPIRED if not subscription.cancellation_date else SubscriptionStatus.CANCELLED
                db.commit()
                db.refresh(subscription)
                
                # Publish subscription.expired event only if it actually became EXPIRED (not CANCELLED)
                if subscription.status == SubscriptionStatus.EXPIRED:
                    try:
                        from app.services.sse_service import sse_service
                        sse_service.publish(
                            channel=f"user:{subscription.user_id}",
                            event="subscription.expired",
                            data={
                                "user_id": subscription.user_id,
                                "status": subscription.status,
                                "message": "Your subscription has expired. Please renew to continue."
                            }
                        )
                    except Exception as sse_err:
                        logger.error(f"Failed to publish subscription expiration SSE event: {sse_err}")
            return None
        return subscription

    @staticmethod
    def check_and_deduct_tokens(db: Session, user: User, tokens_to_deduct: int) -> UserSubscription:
        """
        Check if the user has enough tokens/renders available in their active subscription.
        If yes, deduct the tokens and return the updated subscription.
        If no subscription exists or tokens are insufficient, raise an HTTPException.
        """
        if tokens_to_deduct <= 0:
            return None

        owner_id = SubscriptionService.get_subscription_owner_id(user)
        now = datetime.now(timezone.utc)
        
        # Query the active subscription for the owner with a row lock to prevent race conditions
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == owner_id,
            UserSubscription.is_queued == False,
            or_(
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
            )
        ).order_by(UserSubscription.created_at.desc()).with_for_update().first()

        subscription = SubscriptionService.check_and_update_subscription_expiry(db, subscription)

        if not subscription:
            logger.warning(f"User {user.id} (owner {owner_id}) attempted generation but has no active subscription.")
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="An active subscription is required to perform this action. Please subscribe to a plan."
            )

        # Check if plan has unlimited renders feature flag
        from app.models.subscription import SubscriptionPlan
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        
        # If plan has unlimited renders, skip all limit checks
        if plan and plan.has_unlimited_renders:
            subscription.used_monthly_renders = (subscription.used_monthly_renders or 0) + tokens_to_deduct
            try:
                db.commit()
                db.refresh(subscription)
                logger.info(
                    f"Successfully deducted {tokens_to_deduct} tokens for user {user.id} (owner {owner_id}). "
                    f"New usage: {subscription.used_monthly_renders}/Unlimited"
                )
            except Exception as e:
                db.rollback()
                logger.error(f"Failed to deduct subscription tokens for user {user.id}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update subscription usage. Please try again."
                )
            return subscription

        # Check limit (only for plans without unlimited renders)
        # subscription.initial_monthly_renders = -1 means unlimited (legacy)
        limit = subscription.initial_monthly_renders
        used = subscription.used_monthly_renders or 0

        if limit != -1:
            if used + tokens_to_deduct > limit:
                logger.warning(
                    f"User {user.id} (owner {owner_id}) has insufficient tokens. "
                    f"Limit: {limit}, Used: {used}, Requested: {tokens_to_deduct}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient generation limit. You have {max(0, limit - used)} tokens remaining, but this request requires {tokens_to_deduct} tokens. Please upgrade your plan."
                )

        # Deduct tokens
        subscription.used_monthly_renders = used + tokens_to_deduct
        try:
            db.commit()
            db.refresh(subscription)
            logger.info(
                f"Successfully deducted {tokens_to_deduct} tokens for user {user.id} (owner {owner_id}). "
                f"New usage: {subscription.used_monthly_renders}/{limit if limit != -1 else 'Unlimited'}"
            )
            
            # Post-deduction limit exhaustion check: notify if they have now used all renders
            if limit != -1 and subscription.used_monthly_renders >= limit:
                try:
                    from app.services.sse_service import sse_service
                    sse_service.publish(
                        channel=f"user:{owner_id}",
                        event="subscription.credits_exhausted",
                        data={
                            "user_id": owner_id,
                            "limit": limit,
                            "used": subscription.used_monthly_renders,
                            "message": "Your renders are all used. Please purchase a top-up or upgrade."
                        }
                    )
                except Exception as sse_err:
                    logger.error(f"Failed to publish credits exhausted SSE event post-deduction: {sse_err}")
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to deduct subscription tokens for user {user.id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update subscription usage. Please try again."
            )

        return subscription
