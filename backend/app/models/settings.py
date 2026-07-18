from sqlalchemy import Column, String, Integer, Boolean, JSON, DateTime, UUID
from sqlalchemy.sql import func
from app.core.database import Base

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    # Platform Configuration
    default_request_status = Column(String, default="PENDING_DETECTION") # Immutable via API
    default_currency = Column(String, default="USD")
    default_lead_time_unit = Column(String, default="DAYS")
    ai_provider = Column(String, default="GPT_4")
    retry_limit = Column(Integer, default=3)
    timeout_seconds = Column(Integer, default=30)
    link_expiry_days = Column(Integer, default=7)

    # Feature Toggles
    ai_image_detection = Column(Boolean, default=True)
    guided_visual_quiz = Column(Boolean, default=True)
    prompt_only_flow = Column(Boolean, default=False)
    manufacturer_notifications = Column(Boolean, default=True)
    email_notifications = Column(Boolean, default=True)
    in_app_notifications = Column(Boolean, default=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SystemSettingsLog(Base):
    __tablename__ = "system_settings_logs"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, index=True) # ID of admin who made the change
    changed_field = Column(String, nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
