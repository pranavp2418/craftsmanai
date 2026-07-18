from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, model_validator


class NotificationSettingUpdateRequest(BaseModel):
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    design_approval_alerts: Optional[bool] = None
    manufacturer_updates: Optional[bool] = None
    quote_reminders: Optional[bool] = None

    @model_validator(mode='before')
    @classmethod
    def reject_null_values(cls, data: Any) -> Any:
        if isinstance(data, dict):
            null_fields = [key for key, value in data.items() if value is None]
            if null_fields:
                raise ValueError(
                    f"The following fields cannot be null: {', '.join(null_fields)}"
                )
        return data


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
