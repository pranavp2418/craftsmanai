from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, model_validator, field_validator

from app.schemas.validations import NormalizedEmailStr, normalize_phone_number
from app.core.sanitizer import validate_and_sanitize


class BrandSettingUpdateRequest(BaseModel):
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    business_email: Optional[NormalizedEmailStr] = None
    phone_number: Optional[str] = None
    primary_color: Optional[str] = None

    @field_validator('brand_name')
    @classmethod
    def validate_brand_name(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize brand name to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=255)

    @field_validator('logo_url')
    @classmethod
    def validate_logo_url(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize URL to prevent javascript: schemes. Allow base64 data URIs for upload."""
        if v is None:
            return v
        # Allow base64 data URIs (they will be processed by the service layer)
        if v.startswith("data:image/"):
            return v
        return validate_and_sanitize(v, field_type="url", max_length=500)

    @model_validator(mode="before")
    @classmethod
    def validate_phone_number(cls, data: any) -> any:
        if isinstance(data, dict) and data.get("phone_number"):
            data["phone_number"] = normalize_phone_number(data["phone_number"], validate=True)
        return data


class BrandSettingResponse(BaseModel):
    user_id: int
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    business_email: Optional[str] = None
    phone_number: Optional[str] = None
    primary_color: str
    powered_by_craftsman_ai: bool = True
    is_deactivated: bool = False
    can_use_logo: bool = False
    can_use_brand_name: bool = False
    can_use_custom_color: bool = False
    updated_at: datetime

    class Config:
        from_attributes = True
