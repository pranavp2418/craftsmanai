from __future__ import annotations

import json
from enum import Enum
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator

from app.schemas.validations import NormalizedEmailStr


def _coerce_customer_emails(data: any) -> any:
    if not isinstance(data, dict):
        return data

    email_value = data.get("emails")
    if email_value is None and "email" in data:
        email_value = data.get("email")

    if email_value is None:
        return data

    if isinstance(email_value, str):
        email_text = email_value.strip()
        if not email_text:
            data["emails"] = None
            return data

        try:
            parsed = json.loads(email_text)
        except Exception:
            parsed = email_text
    else:
        parsed = email_value

    if isinstance(parsed, list):
        normalized_emails = []
        for value in parsed:
            if isinstance(value, dict):
                normalized_emails.append(value)
            elif value is not None and str(value).strip():
                normalized_emails.append({"label": "Work", "email": value})
        data["emails"] = normalized_emails
    elif isinstance(parsed, dict):
        data["emails"] = [parsed]
    elif parsed is not None:
        data["emails"] = [{"label": "Work", "email": parsed}]

    return data


class CustomerTag(str, Enum):
    VIP = "VIP Customer"
    ELITE = "Elite Customer"
    PREMIUM = "Premium Customer"
    REGULAR = "Regular Customer"


class EmailAddressSchema(BaseModel):
    label: str = Field(default="Work")
    email: NormalizedEmailStr


class CustomerCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=1)
    tag: Optional[CustomerTag] = None
    emails: Optional[List[EmailAddressSchema]] = None
    phone_number: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = Field(default="Active")  # "Active" or "Inactive"

    @model_validator(mode="before")
    @classmethod
    def normalize_email_payload(cls, data: any) -> any:
        return _coerce_customer_emails(data)


class CustomerUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    tag: Optional[CustomerTag] = None
    emails: Optional[List[EmailAddressSchema]] = None
    phone_number: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None  # "Active" or "Inactive"

    @model_validator(mode="before")
    @classmethod
    def normalize_email_payload(cls, data: any) -> any:
        return _coerce_customer_emails(data)


class CustomerResponse(BaseModel):
    id: int
    created_by_user_id: int
    full_name: str
    tag: Optional[CustomerTag] = None
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
        # If it's already a dictionary
        if isinstance(data, dict):
            name = data.get("full_name") or data.get("name") or ""
            data["full_name"] = name
            
            tag = data.get("tag") or data.get("company_name")
            try:
                data["tag"] = CustomerTag(tag) if tag else None
            except ValueError:
                data["tag"] = None
            
            phone = data.get("phone_number") or data.get("phone")
            data["phone_number"] = phone
            
            address = data.get("location") or data.get("address")
            data["location"] = address
            
            is_active = data.get("is_active", True)
            data["status"] = "Active" if is_active else "Inactive"
            
            email_val = data.get("emails") or data.get("email")
            emails = []
            if email_val:
                try:
                    parsed = json.loads(email_val)
                    if isinstance(parsed, list):
                        emails = parsed
                except Exception:
                    emails = [{"label": "Work", "email": email_val}]
            data["emails"] = emails
            return data
            
        # If it is a SQLAlchemy model or other database object
        name = getattr(data, "full_name", getattr(data, "name", ""))
        tag = getattr(data, "tag", getattr(data, "company_name", None))
        
        # Defensive check for Enum mapping
        tag_val = None
        if tag:
            try:
                tag_val = CustomerTag(tag)
            except ValueError:
                tag_val = None
                
        phone = getattr(data, "phone_number", getattr(data, "phone", None))
        address = getattr(data, "location", getattr(data, "address", None))
        is_active = getattr(data, "is_active", True)
        email_val = getattr(data, "emails", getattr(data, "email", None))
        
        emails = []
        if email_val:
            try:
                parsed = json.loads(email_val)
                if isinstance(parsed, list):
                    emails = parsed
            except Exception:
                emails = [{"label": "Work", "email": email_val}]
                
        return {
            "id": getattr(data, "id"),
            "created_by_user_id": getattr(data, "created_by_user_id"),
            "full_name": name,
            "emails": emails,
            "phone_number": phone,
            "tag": tag_val,
            "location": address,
            "public_token": getattr(data, "public_token"),
            "status": "Active" if is_active else "Inactive",
            "created_at": getattr(data, "created_at"),
            "updated_at": getattr(data, "updated_at", None),
        }


class CustomerListResponse(BaseModel):
    items: List[CustomerResponse]
    total: int
    page: int



class LinkedProject(BaseModel):
    id: int
    design_code: str
    name: str
    jewellery_type: Optional[str] = None
    status: str
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


class TimelineActivity(BaseModel):
    id: int
    action_type: str
    message: str
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerStats(BaseModel):
    total_requests: int
    active_projects: int
    total_spent: float
    last_interaction: Optional[datetime] = None

    class Config:
        from_attributes = True


class CustomerDetailResponse(BaseModel):
    id: int
    created_by_user_id: int
    full_name: str
    tag: Optional[CustomerTag] = None
    emails: List[EmailAddressSchema] = Field(default=[])
    phone_number: Optional[str] = None
    location: Optional[str] = None
    status: str
    public_token: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Detailed additions for premium UI dashboard
    client_since: datetime
    last_interaction: Optional[datetime] = None
    stats: CustomerStats
    linked_projects: List[LinkedProject] = Field(default=[])
    timeline: List[TimelineActivity] = Field(default=[])

    class Config:
        from_attributes = True

