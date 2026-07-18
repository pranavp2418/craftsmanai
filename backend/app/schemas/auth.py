from pydantic import BaseModel, Field, field_validator, validator
from typing import Optional
from datetime import datetime

from app.schemas.validations import NormalizedEmailStr, normalize_phone_number
from app.core.sanitizer import validate_and_sanitize, InputSanitizer


class DeviceInfo(BaseModel):
    device_id: Optional[str] = None
    device_type: Optional[str] = None
    device_os: Optional[str] = None
    browser: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class SignupRequest(BaseModel):
    email: NormalizedEmailStr
    password: str = Field(..., min_length=8)
    business_name: str
    whatsapp_number: str
    remember_me: bool = False
    device_info: Optional[DeviceInfo] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        return v.lower()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @field_validator('whatsapp_number')
    @classmethod
    def validate_whatsapp_number(cls, v):
        return normalize_phone_number(v, validate=True)
    
    @field_validator('business_name')
    @classmethod
    def validate_business_name(cls, v):
        """Sanitize business name to prevent XSS"""
        return validate_and_sanitize(v, field_type="plain", max_length=255)


class SignUpResponse(BaseModel):
    success: bool
    message: str


class LoginRequest(BaseModel):
    email: NormalizedEmailStr
    password: str
    remember_me: bool = False
    device_info: Optional[DeviceInfo] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: str
    email: str
    username: Optional[str] = None
    is_superuser: bool
    is_verified: bool
    notification_message: Optional[str] = None
    profile_image_url: Optional[str] = None
    full_name: Optional[str] = None


class OTPRequest(BaseModel):
    email: NormalizedEmailStr


class OTPVerifyRequest(BaseModel):
    email: NormalizedEmailStr
    otp: str
    device_info: Optional[DeviceInfo] = None


class ResendOTPRequest(BaseModel):
    email: NormalizedEmailStr


class RefreshTokenRequest(BaseModel):
    device_info: Optional[DeviceInfo] = None


class PasswordResetRequest(BaseModel):
    email: NormalizedEmailStr


class PasswordResetConfirm(BaseModel):
    email: NormalizedEmailStr
    token: str
    new_password: str = Field(..., min_length=8)
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool
    is_verified: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: NormalizedEmailStr
    username: Optional[str] = None
    full_name: Optional[str] = None
    password: str
    whatsapp_number: Optional[str] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        return v.lower()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v
    
    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        """Sanitize username to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=100)
    
    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v):
        """Sanitize full name to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=255)


class RefreshTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class MessageResponse(BaseModel):
    message: str
    success: bool = True
