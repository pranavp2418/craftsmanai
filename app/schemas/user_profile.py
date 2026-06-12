from pydantic import BaseModel, Field, EmailStr
from typing import Optional


class UserProfileResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    first_name: str
    last_name: str
    full_name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    business_name: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_superuser: bool
    role: str

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    whatsapp_number: Optional[str] = Field(None, max_length=20)
    username: Optional[str] = Field(None, max_length=100)
    business_name: Optional[str] = Field(None, max_length=255)
    

class AppearanceSettingsUpdate(BaseModel):
    theme: Optional[str] = Field(None, description="UI Theme: System Preference, Light Mode, Dark Mode")
    navigation_color: Optional[str] = Field(None, description="Sidebar navigation color: Light, Dark")

class AppearanceSettingsResponse(BaseModel):
    theme: str
    navigation_color: str

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_new_password: str = Field(..., min_length=8, max_length=100)

class TwoFactorAuthToggleRequest(BaseModel):
    enable_2fa: bool
