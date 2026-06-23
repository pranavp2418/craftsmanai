import html
import re
from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional

from app.schemas.validations import normalize_phone_number


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

    @field_validator('first_name', 'last_name', 'username')
    @classmethod
    def validate_names(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        val = v.strip()
        if val == "":
            return val
        if not re.match(r"^[a-zA-Z0-9\s'\-_]+$", val):
            raise ValueError("Only letters, numbers, spaces, and simple punctuation (-, _, ') are allowed.")
        return val

    @field_validator('business_name')
    @classmethod
    def sanitize_business_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return html.escape(v.strip())
    
    @field_validator('whatsapp_number')
    @classmethod
    def validate_whatsapp_number(cls, v):
        if v is None or v == '':
            return v
        val = v.strip()
        if not re.match(r"^\+?[0-9\s\-()]+$", val):
            raise ValueError("Invalid phone number format: only digits, +, -, spaces, and parentheses are allowed.")
        return normalize_phone_number(val, validate=True)
    

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
