from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class SystemSettingsBase(BaseModel):
    maintenance_mode: Optional[bool] = None
    allow_new_registrations: Optional[bool] = None
    commission_rate: Optional[float] = None
    contact_support_email: Optional[EmailStr] = None


class SystemSettingsUpdate(SystemSettingsBase):
    pass


class SystemSettingsResponse(BaseModel):
    id: int
    maintenance_mode: bool
    allow_new_registrations: bool
    commission_rate: float
    contact_support_email: EmailStr
    created_at: datetime
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
