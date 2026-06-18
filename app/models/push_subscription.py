"""
Push Subscription model - stores WebPush subscription info from browser clients.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # WebPush subscription details
    endpoint = Column(Text, nullable=False)
    p256dh = Column(Text, nullable=False)
    auth = Column(String(255), nullable=False)

    # Browser / device metadata
    device_type = Column(String(100), nullable=True, doc="e.g. chrome, firefox, edge")
    user_agent = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="push_subscriptions")

    def __repr__(self):
        return f"<PushSubscription(id={self.id}, user_id={self.user_id}, active={self.is_active})>"