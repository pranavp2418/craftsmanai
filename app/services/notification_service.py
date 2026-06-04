"""
Notification Service - unified notification delivery across WebSocket and database.

Architecture:
    When a notification is created:
    1. Check if the user has active WebSocket connections via realtime_state
    2. If connected: push notification in real-time via Socket.IO
    3. Always persist to database for history (and offline delivery)
    4. On next WebSocket connect, flush any pending notifications

This ensures delivery regardless of connection state.
"""

import asyncio
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from sqlalchemy.orm import Session

from app.repositories.notification import NotificationRepository
from app.schemas.notification import NotificationResponse, NotificationListResponse
from app.core.socket_manager import send_notification as ws_send_notification
from app.core.realtime_state import realtime_state

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Unified notification delivery service.

    Always persists to DB. If the user is connected via WebSocket, also pushes
    in real-time. If not, the notification is delivered on next connect.
    """

    def __init__(self, db: Session):
        self.db = db
        self.repo = NotificationRepository(db)

    # ------------------------------------------------------------------
    # Send / Create
    # ------------------------------------------------------------------

    def send_notification(
        self,
        *,
        user_id: int,
        type: str = "general",
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
        reference_id: Optional[int] = None,
    ) -> NotificationResponse:
        """
        Create and deliver a notification to a user.

        1. Always persist to database for history & offline delivery.
        2. If the user has active WebSocket sockets, push in real-time.
        """
        # 1. Persist to database
        notification = self.repo.create(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            data=data,
            source=source,
            reference_id=reference_id,
        )

        db_notification = NotificationResponse.model_validate(notification)
        logger.info(
            "Notification saved for user_id=%s type=%s title=%s",
            user_id, type, title,
        )

        # 2. Attempt real-time push via WebSocket (fire-and-forget)
        self._push_ws(user_id, db_notification)

        return db_notification

    def _push_ws(self, user_id: int, notification: NotificationResponse) -> None:
        """
        Attempt to push a notification via WebSocket if the user is connected.
        This is a fire-and-forget operation - if it fails, the notification
        will be delivered when the user reconnects via flush_pending().
        """
        async def _async_push():
            sockets = await realtime_state.list_user_sockets(str(user_id))
            if sockets:
                # User is connected - push in real-time
                await ws_send_notification(
                    user_id=str(user_id),
                    title=notification.title,
                    message=notification.message,
                    notification_type=notification.type,
                    data={
                        **(notification.data or {}),
                        "notification_id": notification.id,
                        "source": notification.source,
                        "reference_id": notification.reference_id,
                        "created_at": notification.created_at.isoformat() if notification.created_at else None,
                    },
                )
                logger.info(
                    "Real-time push sent to user_id=%s notification_id=%s",
                    user_id, notification.id,
                )

        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                # Schedule on the running event loop
                loop.create_task(_async_push())
            else:
                # No running event loop (e.g., CLI, tests)
                new_loop = asyncio.new_event_loop()
                try:
                    new_loop.run_until_complete(_async_push())
                finally:
                    new_loop.close()
        except Exception as exc:
            # Fail silently - notification is already persisted
            logger.error(
                "Real-time push failed for user_id=%s: %s (notification saved to DB)",
                user_id, exc,
            )

    # ------------------------------------------------------------------
    # Retrieve
    # ------------------------------------------------------------------

    def list_notifications(
        self,
        user_id: int,
        *,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> NotificationListResponse:
        """List notifications for a user with pagination."""
        items = self.repo.get_by_user_id(
            user_id,
            limit=limit,
            offset=offset,
            unread_only=unread_only,
        )
        unread_count = self.repo.get_unread_count(user_id)
        # We estimate total from the unread count + the offset/limit context
        # For accurate total, a count query would be needed - but unread_count
        # is the most actionable metric for the UI
        total = unread_count + len(items)  # approximate

        return NotificationListResponse(
            items=[NotificationResponse.model_validate(n) for n in items],
            total=total,
            unread_count=unread_count,
            limit=limit,
            offset=offset,
        )

    def get_unread_count(self, user_id: int) -> int:
        """Return the number of unread notifications for a user."""
        return self.repo.get_unread_count(user_id)

    def mark_as_read(self, notification_id: int, user_id: int) -> bool:
        """Mark a single notification as read."""
        result = self.repo.mark_as_read(notification_id, user_id)
        return result is not None

    def mark_all_as_read(self, user_id: int) -> int:
        """Mark all notifications as read. Returns the count of marked items."""
        return self.repo.mark_all_as_read(user_id)

    def delete(self, notification_id: int, user_id: int) -> bool:
        """Delete a notification."""
        return self.repo.delete(notification_id, user_id)

    # ------------------------------------------------------------------
    # Flush pending notifications on connect
    # ------------------------------------------------------------------

    @staticmethod
    def flush_pending_notifications(
        db: Session,
        user_id: int,
    ) -> int:
        """
        Called when a user connects via WebSocket.
        Retrieves the last 20 notifications from the DB and emits them
        to the user's WebSocket room, then marks all unread as read.

        Returns the number of flushed notifications.
        """
        repo = NotificationRepository(db)
        recent_notifications = repo.get_by_user_id(user_id, limit=20)

        if not recent_notifications:
            return 0

        # Build WS payload for each notification
        notifications_data = []
        for n in recent_notifications:
            notifications_data.append({
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "data": n.data or {},
                "source": n.source,
                "reference_id": n.reference_id,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            })

        # Push via async WebSocket (fire-and-forget)
        async def _emit():
            from app.core.socket_manager import emit_to_user
            for payload in notifications_data:
                try:
                    await emit_to_user(
                        str(user_id),
                        "notification",
                        {
                            "type": payload["type"],
                            "title": payload["title"],
                            "message": payload["message"],
                            "data": payload["data"],
                            "id": str(payload["id"]),
                            "source": payload["source"],
                            "reference_id": payload["reference_id"],
                            "created_at": payload["created_at"],
                            "is_pending_flush": True,
                        },
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to flush notification %s to user %s: %s",
                        payload["id"], user_id, exc,
                    )

        try:
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(_emit())
            finally:
                loop.close()
        except Exception as exc:
            logger.warning(
                "Flush pending WS emit failed for user %s: %s",
                user_id, exc,
            )

        # Mark all as read
        repo.mark_all_as_read(user_id)

        logger.info(
            "Flushed %d pending notification(s) to user_id=%s",
            len(recent_notifications), user_id,
        )
        return len(recent_notifications)
