from typing import Optional
from sqlalchemy.orm import Session
from app.models.brand_setting import BrandSetting
from app.models.user import User


class BrandSettingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_id(self, user_id: int) -> BrandSetting:
        """Fetch brand settings for a user, auto-creating with defaults if they don't exist"""
        setting = self.db.query(BrandSetting).filter(BrandSetting.user_id == user_id).first()
        if not setting:
            user = self.db.query(User).filter(User.id == user_id).first()
            email = user.email if user else None
            business_name = user.business_name if user else "Craftsman AI"
            setting = BrandSetting(
                user_id=user_id,
                brand_name=business_name or "Craftsman AI",
                logo_url=None,
                business_email=email,
                phone_number=None,
                primary_color="#6366F1",
            )
            self.db.add(setting)
            self.db.commit()
            self.db.refresh(setting)
        return setting

    def update_brand_settings(self, brand_setting: BrandSetting, **kwargs) -> BrandSetting:
        """Update brand settings"""
        for field, value in kwargs.items():
            if hasattr(brand_setting, field) and value is not None:
                setattr(brand_setting, field, value)
        self.db.commit()
        self.db.refresh(brand_setting)
        return brand_setting
