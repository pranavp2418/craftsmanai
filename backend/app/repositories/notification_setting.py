from typing import Optional
from sqlalchemy.orm import Session
from app.models.notification_setting import NotificationSetting


class NotificationSettingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_id(self, user_id: int) -> NotificationSetting:
        """Fetch notification settings for a user, auto-creating with defaults if they don't exist"""
        setting = self.db.query(NotificationSetting).filter(NotificationSetting.user_id == user_id).first()
        if not setting:
            setting = NotificationSetting(
                user_id=user_id,
                email_notifications=True,
                push_notifications=True,
                design_approval_alerts=True,
                manufacturer_updates=True,
                quote_reminders=False,
            )
            self.db.add(setting)
            self.db.commit()
            self.db.refresh(setting)
        return setting

    def update_settings(self, user_id: int, **kwargs) -> NotificationSetting:
        """Update a user's notification settings"""
        setting = self.get_by_user_id(user_id)
        for field, value in kwargs.items():
            if hasattr(setting, field) and value is not None:
                setattr(setting, field, value)
        self.db.commit()
        self.db.refresh(setting)
        return setting
