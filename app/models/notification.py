"""
Notification model - persists notifications for offline delivery.
When a user is not connected via WebSocket, notifications are stored in the database
and delivered on next connection.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime
from app.core.timezone import CST_TZ


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type = Column(String(50), nullable=False, default="general")
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    data = Column(JSON, nullable=True, default={})

    # Read tracking
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    source = Column(String(50), nullable=True, doc="What triggered this notification (e.g., 'order', 'design')")
    reference_id = Column(Integer, nullable=True, doc="ID of the referenced entity (e.g., order_id, design_id)")

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.now(CST_TZ), index=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.now(CST_TZ), onupdate=datetime.now(CST_TZ))

    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type}, is_read={self.is_read})>"