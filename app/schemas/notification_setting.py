from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationSettingUpdateRequest(BaseModel):
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    design_approval_alerts: Optional[bool] = None
    manufacturer_updates: Optional[bool] = None
    quote_reminders: Optional[bool] = None


class NotificationSettingResponse(BaseModel):
    user_id: int
    email_notifications: bool
    push_notifications: bool
    design_approval_alerts: bool
    manufacturer_updates: bool
    quote_reminders: bool
    updated_at: datetime

    class Config:
        from_attributes = True
