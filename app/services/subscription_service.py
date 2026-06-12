import logging
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.subscription import UserSubscription, SubscriptionStatus

logger = logging.getLogger(__name__)

class SubscriptionService:
    @staticmethod
    def get_subscription_owner_id(user: User) -> int:
        """Get the ID of the user who owns the subscription (workspace owner)."""
        if user.is_team_member and user.team_owner_id:
            return user.team_owner_id
        return user.id

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
        
        # Query the active subscription for the owner with a row lock to prevent race conditions
        subscription = db.query(UserSubscription).filter(
            UserSubscription.user_id == owner_id,
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            UserSubscription.is_queued == False
        ).order_by(UserSubscription.created_at.desc()).with_for_update().first()

        if not subscription:
            logger.warning(f"User {user.id} (owner {owner_id}) attempted generation but has no active subscription.")
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="An active subscription is required to perform this action. Please subscribe to a plan."
            )

        # Check limit
        # subscription.initial_monthly_renders = -1 means unlimited
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
