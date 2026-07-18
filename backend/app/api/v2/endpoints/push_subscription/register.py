"""
Push Subscription endpoints - register, list, remove, and test push notifications.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.repositories.push_subscription import PushSubscriptionRepository
from app.schemas.push_subscription import (
    PushSubscriptionRegister,
    PushSubscriptionResponse,
)
from app.services.webpush_service import WebPushService

router = APIRouter()


@router.post("/", response_model=PushSubscriptionResponse, status_code=status.HTTP_201_CREATED)
def register_push_subscription(
    payload: PushSubscriptionRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Register a browser push subscription for the authenticated user."""
    repo = PushSubscriptionRepository(db)
    subscription = repo.create(
        user_id=current_user.id,
        endpoint=payload.endpoint,
        p256dh=payload.p256dh,
        auth=payload.auth,
        device_type=payload.device_type,
        user_agent=payload.user_agent,
    )
    return PushSubscriptionResponse(
        id=subscription.id,
        user_id=subscription.user_id,
        device_type=subscription.device_type,
        is_active=subscription.is_active,
        created_at=subscription.created_at.isoformat() if subscription.created_at else None,
    )


@router.get("/", response_model=list[PushSubscriptionResponse])
def list_push_subscriptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all active push subscriptions for the authenticated user."""
    repo = PushSubscriptionRepository(db)
    subscriptions = repo.get_by_user_id(current_user.id)
    return [
        PushSubscriptionResponse(
            id=sub.id,
            user_id=sub.user_id,
            device_type=sub.device_type,
            is_active=sub.is_active,
            created_at=sub.created_at.isoformat() if sub.created_at else None,
        )
        for sub in subscriptions
    ]


@router.delete("/{endpoint:path}", status_code=status.HTTP_204_NO_CONTENT)
def remove_push_subscription(
    endpoint: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Remove (deactivate) a push subscription by its endpoint URL."""
    repo = PushSubscriptionRepository(db)
    repo.deactivate(endpoint)
    return None


@router.get("/vapid-public-key")
def get_vapid_public_key():
    """Return the VAPID public key for the frontend to use when subscribing to push notifications."""
    public_key = WebPushService.get_public_key()
    if not public_key:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail="Web Push is not configured (VAPID_PUBLIC_KEY missing)",
        )
    return {"public_key": public_key}


# ---------------------------------------------------------------------------
# TEMP TEST ENDPOINT - send a test push notification (remove in production)
# ---------------------------------------------------------------------------
class TestPushRequest(BaseModel):
    title: str = "Test Notification"
    body: str = "This is a test push notification from Craftmen!"
    url: Optional[str] = None


@router.post("/test-send")
def test_send_push(
    payload: TestPushRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Send a test push notification to the authenticated user's ALL active devices.
    Uses the production WebPushService.send_push which sends to every subscription.

    NOTE: For the push to actually work, you need a REAL browser push subscription.
    """
    sent_count = WebPushService.send_push(
        db=db,
        user_id=current_user.id,
        title=payload.title,
        body=payload.body,
        url=payload.url,
        data={"type": "test", "source": "test-endpoint"},
    )

    if sent_count == 0:
        # Check why it failed
        from app.models.notification_setting import NotificationSetting
        from app.models.push_subscription import PushSubscription

        notif_setting = db.query(NotificationSetting).filter(
            NotificationSetting.user_id == current_user.id
        ).first()
        push_enabled = notif_setting.push_notifications if notif_setting else True
        active_subs = db.query(PushSubscription).filter(
            PushSubscription.user_id == current_user.id,
            PushSubscription.is_active == True,
        ).count()

        if active_subs == 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No active push subscriptions found for your account. "
                    "First register a subscription via POST /push-subscriptions/ "
                    "with real browser push subscription data."
                ),
            )
        if not push_enabled:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Push notifications are DISABLED in your notification settings. "
                    "Enable push_notifications first."
                ),
            )
        raise HTTPException(
            status_code=500,
            detail="Push notification failed. Check VAPID key configuration.",
        )

    return {
        "message": f"Push notification sent to {sent_count} device(s)",
        "sent_count": sent_count,
        "note": f"Sent to ALL {sent_count} active subscriptions for this user.",
    }
