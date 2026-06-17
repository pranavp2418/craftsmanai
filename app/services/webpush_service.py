"""
WebPush Notification Service - sends browser push notifications using VAPID/WebPush.

When a user has push_notifications enabled in their notification settings and
has active push subscriptions registered, this service delivers browser push notifications.
"""

import json
import logging
from typing import Optional, Dict, Any

from pywebpush import webpush, WebPushException
from py_vapid import Vapid
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.push_subscription import PushSubscription
from app.models.notification_setting import NotificationSetting

logger = logging.getLogger(__name__)


class WebPushService:
    """Service for sending WebPush (browser) notifications."""

    @staticmethod
    def get_public_key() -> Optional[str]:
        """Return the VAPID public key for the frontend to use."""
        return settings.VAPID_PUBLIC_KEY

    @staticmethod
    def _get_vapid_private_key():
        """Return a Vapid object loaded from the private key PEM string."""
        key = settings.VAPID_PRIVATE_KEY
        if not key:
            return None
        # .env stores newlines as literal \n - convert them to real newlines
        key = key.replace("\\n", "\n")
        # Load the PEM key using cryptography, then set it on Vapid
        priv_key = load_pem_private_key(key.encode(), password=None)
        vapid = Vapid()
        vapid.private_key = priv_key
        return vapid

    @staticmethod
    def _get_vapid_claims() -> Optional[Dict[str, str]]:
        """Return the VAPID claims dict."""
        email = settings.VAPID_CLAIM_EMAIL
        if not email:
            return None
        return {"sub": email}

    @classmethod
    def send_push(
        cls,
        db: Session,
        user_id: int,
        title: str,
        body: str,
        url: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
        tag: Optional[str] = None,
    ) -> int:
        """
        Send a web push notification to all active subscriptions of a user.

        Only sends if:
        1. push_notifications is enabled in the user's NotificationSetting
        2. The user has active push subscriptions
        3. VAPID keys are configured

        Returns the number of subscriptions successfully notified.
        """
        # Check if VAPID keys are configured
        vapid_private_key = cls._get_vapid_private_key()
        vapid_claims = cls._get_vapid_claims()
        if not vapid_private_key:
            logger.warning("VAPID_PRIVATE_KEY not configured – skipping push notification")
            return 0

        # Check user notification settings
        notif_setting = db.query(NotificationSetting).filter(
            NotificationSetting.user_id == user_id
        ).first()
        if not notif_setting or not notif_setting.push_notifications:
            logger.debug("Push notifications disabled for user_id=%s", user_id)
            return 0

        # Get all active subscriptions for this user
        subscriptions = db.query(PushSubscription).filter(
            PushSubscription.user_id == user_id,
            PushSubscription.is_active == True,
        ).all()

        if not subscriptions:
            logger.debug("No active push subscriptions for user_id=%s", user_id)
            return 0

        # Build the payload
        payload = {
            "title": title,
            "body": body,
            "icon": "https://craftsmanai.app/dark%20mode%20logo.png",
        }
        if url:
            payload["url"] = url
        if data:
            payload["data"] = data
        if tag:
            payload["tag"] = tag

        payload_str = json.dumps(payload)

        # Send to each subscription
        successful = 0
        for sub in subscriptions:
            try:
                subscription_info = {
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth,
                    },
                }
                webpush(
                    subscription_info=subscription_info,
                    data=payload_str,
                    vapid_private_key=vapid_private_key,
                    vapid_claims=vapid_claims,
                    ttl=86400,  # 24 hours
                )
                successful += 1
                logger.info(
                    "Push notification sent to user_id=%s subscription_id=%s",
                    user_id, sub.id,
                )
            except WebPushException as exc:
                # HTTP 404 or 410 means the subscription is expired/revoked
                if hasattr(exc, 'response') and exc.response is not None:
                    status_code = getattr(exc.response, 'status_code', 0)
                    if status_code in (404, 410):
                        logger.info(
                            "Push subscription expired (HTTP %s) for subscription_id=%s, deactivating",
                            status_code, sub.id,
                        )
                        sub.is_active = False
                        db.commit()
                        continue
                logger.warning(
                    "Push notification failed for subscription_id=%s: %s",
                    sub.id, exc,
                )
            except Exception as exc:
                logger.warning(
                    "Unexpected error sending push to subscription_id=%s: %s",
                    sub.id, exc,
                )

        return successful

    @classmethod
    def send_design_failed_push(
        cls,
        db: Session,
        user_id: int,
        design_id: int,
        design_code: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> int:
        """
        Send a push notification when a design generation fails.

        Checks the user's push_notifications setting before sending.
        """
        title = "Design Generation Failed"
        body = "Your design generation has failed. Please try again."
        if design_code:
            body = f"Design '{design_code}' generation failed. Please try again."
        if error_message:
            # Truncate error message for push notification readability
            short_error = error_message[:100] + ("..." if len(error_message) > 100 else "")
            body = f"{body}\nError: {short_error}"

        url = f"/designs/{design_id}"

        return cls.send_push(
            db=db,
            user_id=user_id,
            title=title,
            body=body,
            url=url,
            data={
                "design_id": design_id,
                "design_code": design_code,
                "type": "design_failed",
            },
            tag=f"design-failed-{design_id}",
        )