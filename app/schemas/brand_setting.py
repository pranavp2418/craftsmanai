from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, model_validator

from app.schemas.validations import NormalizedEmailStr


class BrandSettingUpdateRequest(BaseModel):
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    business_email: Optional[NormalizedEmailStr] = None
    phone_number: Optional[str] = None
    primary_color: Optional[str] = None


class BrandSettingResponse(BaseModel):
    user_id: int
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    business_email: Optional[str] = None
    phone_number: Optional[str] = None
    primary_color: str
    powered_by_craftsman_ai: bool = True
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
                "updated_at": data.updated_at
            }
        return data
