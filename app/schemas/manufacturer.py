from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional, List
import json

from pydantic import BaseModel, EmailStr, Field, model_validator
from app.schemas.customer import EmailAddressSchema


class ManufacturerSpeciality(str, Enum):
    GOLD_SPECIALIST = "Gold Specialist"
    GEMSTONE_SPECIALIST = "Gemstone Specialist"
    PLATINUM_SPECIALIST = "Platinum Specialist"
    DIAMOND_SETTING = "Diamond Setting"
    COLORED_GEMSTONES = "Colored Gemstones"
    PEARL_JEWELRY = "Pearl Jewelry"
    SILVER_SPECIALIST = "Silver Specialist"
    ENAMEL_WORK = "Enamel Work"


class ManufacturerCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    speciality: Optional[ManufacturerSpeciality] = None
    emails: Optional[List[EmailAddressSchema]] = None
    phone_number: Optional[str] = None
    location: Optional[str] = None


class ManufacturerUpdateRequest(BaseModel):
    name: Optional[str] = None
    speciality: Optional[ManufacturerSpeciality] = None
    emails: Optional[List[EmailAddressSchema]] = None
    phone_number: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None


class ManufacturerResponse(BaseModel):
    id: int
    created_by_user_id: int
    name: str
    speciality: Optional[ManufacturerSpeciality] = None
    emails: List[EmailAddressSchema] = Field(default=[])
    phone_number: Optional[str] = None
    location: Optional[str] = None
    status: str
    public_token: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def format_db_fields(cls, data: any) -> any:
        if isinstance(data, dict):
            name = data.get("name") or ""
            data["name"] = name
            
            spec = data.get("speciality") or data.get("company_name")
            try:
                data["speciality"] = ManufacturerSpeciality(spec) if spec else None
            except ValueError:
                data["speciality"] = None
            
            phone = data.get("phone_number") or data.get("phone")
            data["phone_number"] = phone
            
            address = data.get("location") or data.get("address")
            data["location"] = address
            
            is_active = data.get("is_active", True)
            data["status"] = "Active" if is_active else "Inactive"
            
            email_val = data.get("emails") or data.get("email")
            emails = []
            if email_val:
                if isinstance(email_val, list):
                    emails = email_val
                elif isinstance(email_val, str):
                    try:
                        parsed = json.loads(email_val)
                        if isinstance(parsed, list):
                            emails = parsed
                    except Exception:
                        emails = [{"label": "Work", "email": email_val}]
            data["emails"] = emails
            return data

        name = getattr(data, "name", "")
        spec_val = getattr(data, "speciality", None) or getattr(data, "company_name", None)
        try:
            speciality = ManufacturerSpeciality(spec_val) if spec_val else None
        except ValueError:
            speciality = None
            
        phone = getattr(data, "phone_number", None) or getattr(data, "phone", None)
        address = getattr(data, "location", None) or getattr(data, "address", None)
        is_active = getattr(data, "is_active", True)
        
        email_val = getattr(data, "emails", None) or getattr(data, "email", None)
        emails = []
        if email_val:
            if isinstance(email_val, list):
                emails = email_val
            elif isinstance(email_val, str):
                try:
                    parsed = json.loads(email_val)
                    if isinstance(parsed, list):
                        emails = parsed
                except Exception:
                    emails = [{"label": "Work", "email": email_val}]
                    
        return {
            "id": getattr(data, "id"),
            "created_by_user_id": getattr(data, "created_by_user_id"),
            "name": name,
            "emails": emails,
            "phone_number": phone,
            "speciality": speciality,
            "location": address,
            "public_token": getattr(data, "public_token"),
            "status": "Active" if is_active else "Inactive",
            "created_at": getattr(data, "created_at"),
            "updated_at": getattr(data, "updated_at", None),
        }


class ManufacturerListResponse(BaseModel):
    items: List[ManufacturerResponse]
    total: int
    page: int



class SentRequest(BaseModel):
    id: int
    design_code: str
    name: str
    jewellery_type: Optional[str] = None
    status: str
    created_at: datetime
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


class ProductionStep(BaseModel):
    id: int
    action_type: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class ManufacturerStats(BaseModel):
    total_requests: int
    completed_requests: int
    total_profit: float
    pending_requests: int
    avg_response_time: str
    last_activity: Optional[datetime] = None

    class Config:
        from_attributes = True


class ManufacturerDetailResponse(BaseModel):
    id: int
    created_by_user_id: int
    name: str
    speciality: Optional[ManufacturerSpeciality] = None
    emails: List[EmailAddressSchema] = Field(default=[])
    phone_number: Optional[str] = None
    location: Optional[str] = None
    status: str
    public_token: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Detailed additions for premium UI dashboard
    stats: ManufacturerStats
    sent_requests: List[SentRequest] = Field(default=[])
    production_timeline: List[ProductionStep] = Field(default=[])

    class Config:
        from_attributes = True
