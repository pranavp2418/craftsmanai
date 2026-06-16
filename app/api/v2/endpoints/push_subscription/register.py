"""
Push Subscription endpoints - register, list, remove, and test push notifications.
"""

from typing import Optional
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
    TEMP ENDPOINT: Send a test push notification to the authenticated user.
    Only works if the user has active push subscriptions and push_notifications enabled.
    Remove this endpoint before production deployment.

    NOTE: For the push to actually work, you need a REAL browser push subscription.
    A fake/test endpoint URL will not receive notifications.
    """
    from app.models.notification_setting import NotificationSetting
    from app.models.push_subscription import PushSubscription

    # Debug info
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

    # Try direct push with detailed error reporting
    from pywebpush import webpush, WebPushException
    from py_vapid import Vapid
    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    from app.core.config import settings as cfg
    import json as _json

    vapid_key_str = cfg.VAPID_PRIVATE_KEY
    if vapid_key_str:
        vapid_key_str = vapid_key_str.replace("\\n", "\n")
    priv_key = load_pem_private_key(vapid_key_str.encode(), password=None)
    vapid = Vapid()
    vapid.private_key = priv_key
    vapid_claims = {"sub": cfg.VAPID_CLAIM_EMAIL} if cfg.VAPID_CLAIM_EMAIL else None

    # Get the most recent subscription (the real one)
    last_sub = db.query(PushSubscription).filter(
        PushSubscription.user_id == current_user.id,
        PushSubscription.is_active == True,
    ).order_by(PushSubscription.id.desc()).first()

    if not last_sub:
        raise HTTPException(status_code=400, detail="No active subscriptions")

    subscription_info = {
        "endpoint": last_sub.endpoint,
        "keys": {"p256dh": last_sub.p256dh, "auth": last_sub.auth},
    }
    payload_str = _json.dumps({"title": payload.title, "body": payload.body, "url": payload.url, "data": {"type": "test"}})

    errors = []
    try:
        webpush(subscription_info, payload_str, vapid_private_key=vapid, vapid_claims=vapid_claims, ttl=86400)
        return {"message": "Push notification sent successfully!", "subscription_id": last_sub.id}
    except WebPushException as exc:
        resp = getattr(exc, 'response', None)
        status = getattr(resp, 'status_code', 'unknown') if resp else 'unknown'
        body = ''
        if resp:
            try:
                body = resp.text if hasattr(resp, 'text') else str(resp)
            except:
                body = str(resp)
        raise HTTPException(status_code=400, detail=f"Push failed (HTTP {status}): {body[:500]}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Push error: {str(exc)}")

    return {
        "message": f"Push notification sent successfully to {sent_count} subscription(s)",
        "sent_count": sent_count,
    }
