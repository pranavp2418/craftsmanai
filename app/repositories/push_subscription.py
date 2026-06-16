from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.push_subscription import PushSubscription


class PushSubscriptionRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_id(self, user_id: int) -> List[PushSubscription]:
        """Fetch all active push subscriptions for a user."""
        return self.db.query(PushSubscription).filter(
            PushSubscription.user_id == user_id,
            PushSubscription.is_active == True,
        ).all()

    def get_by_endpoint(self, endpoint: str) -> Optional[PushSubscription]:
        """Fetch a subscription by its endpoint URL."""
        return self.db.query(PushSubscription).filter(
            PushSubscription.endpoint == endpoint
        ).first()

    def create(
        self,
        user_id: int,
        endpoint: str,
        p256dh: str,
        auth: str,
        device_type: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> PushSubscription:
        """Register a new push subscription."""
        # Check if this endpoint already exists
        existing = self.get_by_endpoint(endpoint)
        if existing:
            # Update existing subscription
            existing.user_id = user_id
            existing.p256dh = p256dh
            existing.auth = auth
            existing.device_type = device_type
            existing.user_agent = user_agent
            existing.is_active = True
            self.db.commit()
            self.db.refresh(existing)
            return existing

        subscription = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            device_type=device_type,
            user_agent=user_agent,
        )
        self.db.add(subscription)
        self.db.commit()
        self.db.refresh(subscription)
        return subscription

    def deactivate(self, endpoint: str) -> bool:
        """Deactivate a push subscription by endpoint."""
        subscription = self.get_by_endpoint(endpoint)
        if subscription:
            subscription.is_active = False
            self.db.commit()
            return True
        return False

    def deactivate_all_for_user(self, user_id: int) -> int:
        """Deactivate all push subscriptions for a user. Returns count."""
        subscriptions = self.db.query(PushSubscription).filter(
            PushSubscription.user_id == user_id,
            PushSubscription.is_active == True,
        ).all()
        count = len(subscriptions)
        for sub in subscriptions:
            sub.is_active = False
        self.db.commit()
        return count

    def delete(self, subscription_id: int, user_id: int) -> bool:
        """Delete a push subscription."""
        subscription = self.db.query(PushSubscription).filter(
            PushSubscription.id == subscription_id,
            PushSubscription.user_id == user_id,
        ).first()
        if subscription:
            self.db.delete(subscription)
            self.db.commit()
            return True
        return False