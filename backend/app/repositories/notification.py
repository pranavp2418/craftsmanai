"""
Repository for persisting and retrieving user notifications.
"""

from typing import List, Optional, Dict, Any
from app.core.timezone import now as tz_now
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.notification import Notification


class NotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        *,
        user_id: int,
        type: str = "general",
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None,
        source: Optional[str] = None,
        reference_id: Optional[int] = None,
    ) -> Notification:
        """Create and persist a new notification for a user."""
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            data=data or {},
            source=source,
            reference_id=reference_id,
        )
        self.db.add(notification)
        self.db.commit()
        self.db.refresh(notification)
        return notification

    def get_unread_by_user_id(self, user_id: int) -> List[Notification]:
        """Fetch all unread notifications for a user, ordered by most recent first."""
        return (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
            .order_by(desc(Notification.created_at))
            .all()
        )

    def get_by_user_id(
        self,
        user_id: int,
        *,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> List[Notification]:
        """Fetch notifications for a user with pagination."""
        query = self.db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            query = query.filter(Notification.is_read == False)
        return (
            query
            .order_by(desc(Notification.created_at))
            .offset(offset)
            .limit(limit)
            .all()
        )

    def mark_as_read(self, notification_id: int, user_id: int) -> Optional[Notification]:
        """Mark a single notification as read."""
        notification = (
            self.db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
            .first()
        )
        if notification:
            notification.is_read = True
            notification.read_at = tz_now()
            self.db.commit()
            self.db.refresh(notification)
        return notification

    def mark_all_as_read(self, user_id: int) -> int:
        """Mark all unread notifications as read. Returns count of updated rows."""
        now = tz_now()
        result = (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
            .update({"is_read": True, "read_at": now})
        )
        self.db.commit()
        return result

    def get_unread_count(self, user_id: int) -> int:
        """Return the number of unread notifications for a user."""
        return (
            self.db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
            .count()
        )

    def delete(self, notification_id: int, user_id: int) -> bool:
        """Delete a notification by ID (scoped to user)."""
        notification = (
            self.db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
            .first()
        )
        if notification:
            self.db.delete(notification)
            self.db.commit()
            return True
        return False