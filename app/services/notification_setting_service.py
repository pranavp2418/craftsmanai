from sqlalchemy.orm import Session
from app.models.notification_setting import NotificationSetting
from app.repositories.notification_setting import NotificationSettingRepository


class NotificationSettingService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = NotificationSettingRepository(db)

    def get_settings(self, user_id: int) -> NotificationSetting:
        return self.repository.get_by_user_id(user_id)

    def update_settings(self, user_id: int, **kwargs) -> NotificationSetting:
        return self.repository.update_settings(user_id, **kwargs)
