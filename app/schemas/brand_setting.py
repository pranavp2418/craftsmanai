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
        """Sanitize URL to prevent javascript: schemes"""
        if v is None:
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
    updated_at: datetime

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def compute_fields(cls, data):
        # Gracefully handle dynamic Pydantic mapping
        if hasattr(data, "user") and data.user:
            plan = data.user.subscription_plan or "Starter"
            return {
                "user_id": data.user_id,
                "brand_name": data.brand_name,
                "logo_url": data.logo_url,
                "business_email": data.business_email,
                "phone_number": data.phone_number,
                "primary_color": data.primary_color,
                "powered_by_craftsman_ai": plan in ("Starter", "Pro"),
                "is_deactivated": getattr(data, "is_deactivated", False),
                "updated_at": data.updated_at
            }
        return data
