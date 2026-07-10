from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from datetime import datetime
from app.core.timezone import CST_TZ


class NotificationSetting(Base):
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True, nullable=False)
    
    # 5 toggle settings as shown in the UI mockup
    email_notifications = Column(Boolean, default=True, nullable=False)
    push_notifications = Column(Boolean, default=True, nullable=False)
    design_approval_alerts = Column(Boolean, default=True, nullable=False)
    manufacturer_updates = Column(Boolean, default=True, nullable=False)
    quote_reminders = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.now(CST_TZ), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.now(CST_TZ), onupdate=datetime.now(CST_TZ), nullable=False)

    # Relationship
    user = relationship("User", back_populates="notification_settings")

    def __repr__(self):
        return f"<NotificationSetting(id={self.id}, user_id={self.user_id})>"
