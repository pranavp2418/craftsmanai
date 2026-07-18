import phonenumbers
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime

from app.core.sanitizer import validate_and_sanitize


class ContactSubmissionCreate(BaseModel):
    """Schema for creating a contact form submission."""
    full_name: str = Field(..., min_length=1, max_length=255, description="Sender's full name")
    business_name: str = Field(..., min_length=1, max_length=255, description="Business name")
    email: EmailStr = Field(..., description="Sender's email address")
    phone: Optional[str] = Field(None, max_length=50, description="Sender's phone number")
    store_type: Optional[str] = Field(None, max_length=255, description="Type of store")
    interest: Optional[str] = Field(None, description="What they are interested in")

    model_config = {"extra": "forbid"}

    @field_validator("full_name", "business_name", "store_type", "interest")
    @classmethod
    def validate_text_fields(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize text fields to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=255)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                number = phonenumbers.parse(v)
                if not phonenumbers.is_valid_number(number):
                    raise ValueError("Invalid phone number format")
            except phonenumbers.NumberParseException:
                raise ValueError("Invalid phone number format")
        return v


class ContactSubmissionResponse(BaseModel):
    """Schema for contact submission response."""
    id: int
    full_name: str
    business_name: str
    email: str
    phone: Optional[str] = None
    store_type: Optional[str] = None
    interest: Optional[str] = None
    email_sent: bool
    email_sent_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContactMessageResponse(BaseModel):
    """Simple success response for contact form submission."""
    status: str = "success"
    message: str = "Thank you for reaching out! We will get back to you shortly."