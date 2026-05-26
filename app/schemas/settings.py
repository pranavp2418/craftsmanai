from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class SystemSettingsBase(BaseModel):
    default_currency: Optional[str] = None
    default_lead_time_unit: Optional[str] = None
    ai_provider: Optional[str] = None
    retry_limit: Optional[int] = None
    timeout_seconds: Optional[int] = None
    link_expiry_days: Optional[int] = None
    
    # Feature Toggles
    ai_image_detection: Optional[bool] = None
    guided_visual_quiz: Optional[bool] = None
    prompt_only_flow: Optional[bool] = None
    manufacturer_notifications: Optional[bool] = None
    email_notifications: Optional[bool] = None
    in_app_notifications: Optional[bool] = None


class SystemSettingsUpdate(SystemSettingsBase):
    pass


class SystemSettingsResponse(BaseModel):
    id: int
    default_request_status: str
    default_currency: str
    default_lead_time_unit: str
    ai_provider: str
    retry_limit: int
    timeout_seconds: int
    link_expiry_days: int
    ai_image_detection: bool
    guided_visual_quiz: bool
    prompt_only_flow: bool
    manufacturer_notifications: bool
    email_notifications: bool
    in_app_notifications: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class SystemSettingsLogResponse(BaseModel):
    id: int
    admin_id: int
    changed_field: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
