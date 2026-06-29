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
        """Sanitize URL to prevent javascript: schemes. Allow base64 data URIs for upload.
        Only .jpg, .jpeg, .png, .webp, and .gif image formats are accepted."""
        if v is None:
            return v
        
        ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
        ALLOWED_MIME_TYPES = {'image/jpeg', 'image/png', 'image/webp'}
        
        # Validate base64 data URIs by MIME type
        if v.startswith("data:image/"):
            # Extract MIME type from data URI: data:image/png;base64,...
            mime_type = v.split(";")[0] if ";" in v else v.split(",")[0]
            mime_type = mime_type.replace("data:", "")
            if mime_type not in ALLOWED_MIME_TYPES:
                raise ValueError(
                    f"Invalid image format. Only JPG, PNG, WebP are allowed. Got: {mime_type}"
                )
            return v
        
        # Validate URL by file extension
        url_lower = v.lower().rstrip('/')
        if not any(url_lower.endswith(ext) for ext in ALLOWED_EXTENSIONS):
            raise ValueError(
                "Logo URL must end with .jpg, .jpeg, .png, .webp extension."
            )
        
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
