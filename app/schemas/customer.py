from __future__ import annotations

import json
import ast
from enum import Enum
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator, field_validator
from email_validator import EmailNotValidError, validate_email

from app.schemas.validations import normalize_phone_number


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
            try:
                parsed = ast.literal_eval(email_text)
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
    email: str

    @field_validator('email')
    @classmethod
    def validate_email_format(cls, v):
        if not v:
            return v
        email_normalized = str(v).strip().lower()
        try:
            validate_email(email_normalized, check_deliverability=False)
        except EmailNotValidError:
            raise ValueError("Invalid email address")
        return email_normalized


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

    @model_validator(mode="before")
    @classmethod
    def validate_phone_number(cls, data: any) -> any:
        if isinstance(data, dict) and data.get("phone_number"):
            data["phone_number"] = normalize_phone_number(data["phone_number"], validate=True)
        return data

    @model_validator(mode="after")
    def validate_unique_emails(self) -> "CustomerCreateRequest":
        if self.emails:
            email_list = [email.email.lower() for email in self.emails]
            if len(email_list) != len(set(email_list)):
                raise ValueError("Emails must be unique")
        return self


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

    @model_validator(mode="before")
    @classmethod
    def validate_phone_number(cls, data: any) -> any:
        if isinstance(data, dict) and data.get("phone_number"):
            data["phone_number"] = normalize_phone_number(data["phone_number"], validate=True)
        return data

    @model_validator(mode="after")
    def validate_unique_emails(self) -> "CustomerUpdateRequest":
        if self.emails:
            email_list = [email.email.lower() for email in self.emails]
            if len(email_list) != len(set(email_list)):
                raise ValueError("Emails must be unique")
        return self


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
            if isinstance(email_val, list):
                emails = [item for item in email_val if item is not None]
            elif isinstance(email_val, dict):
                emails = [email_val]
            elif email_val:
                try:
                    parsed = json.loads(email_val)
                    if isinstance(parsed, list):
                        emails = parsed
                    elif isinstance(parsed, dict):
                        emails = [parsed]
                    else:
                        emails = [{"label": "Work", "email": email_val}]
                except Exception:
                    try:
                        parsed = ast.literal_eval(email_val)
                        if isinstance(parsed, list):
                            emails = parsed
                        elif isinstance(parsed, dict):
                            emails = [parsed]
                        else:
                            emails = [{"label": "Work", "email": email_val}]
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
        if isinstance(email_val, list):
            emails = [item for item in email_val if item is not None]
        elif isinstance(email_val, dict):
            emails = [email_val]
        elif email_val:
            try:
                parsed = json.loads(email_val)
                if isinstance(parsed, list):
                    emails = parsed
                elif isinstance(parsed, dict):
                    emails = [parsed]
                else:
                    emails = [{"label": "Work", "email": email_val}]
            except Exception:
                try:
                    parsed = ast.literal_eval(email_val)
                    if isinstance(parsed, list):
                        emails = parsed
                    elif isinstance(parsed, dict):
                        emails = [parsed]
                    else:
                        emails = [{"label": "Work", "email": email_val}]
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


class SharedCustomerSummary(BaseModel):
    id: int
    full_name: str
    emails: List[EmailAddressSchema] = Field(default=[])
    phone_number: Optional[str] = None
    location: Optional[str] = None
    status: str
    public_token: str

    class Config:
        from_attributes = True


class CustomerDesignShareItem(BaseModel):
    customer_name: str
    email: Optional[str] = None
    shared_on: datetime
    status: str
    customer_comment_or_feedback: Optional[str] = None
    token: str

    class Config:
        from_attributes = True


class VariantSummary(BaseModel):
    id: int
    variant_name: str
    version_number: int
    base_design_image_url: Optional[str] = None
    is_selected: bool
    design_focus: Optional[str] = None
    style_tags: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DesignSummary(BaseModel):
    id: int
    design_code: str
    name: str
    jewellery_type: Optional[str] = None
    user_prompt: Optional[str] = None
    input_image_url: Optional[str] = None
    input_image_urls: Optional[List[str]] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ShareDetail(BaseModel):
    share_id: int
    public_token: str
    share_status: str
    share_comment: Optional[str] = None
    share_reviewed_at: Optional[datetime] = None
    shared_at: Optional[datetime] = None
    share_created_at: Optional[datetime] = None
    customer: SharedCustomerSummary
    variant: VariantSummary
    design: DesignSummary

    class Config:
        from_attributes = True


CustomerDesignSharesResponse = List[CustomerDesignShareItem]

