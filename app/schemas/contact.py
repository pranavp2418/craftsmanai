from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class ContactSubmissionCreate(BaseModel):
    """Schema for creating a contact form submission."""
    full_name: str = Field(..., min_length=1, max_length=255, description="Sender's full name")
    business_name: str = Field(..., min_length=1, max_length=255, description="Business name")
    email: EmailStr = Field(..., description="Sender's email address")
    phone: Optional[str] = Field(None, max_length=50, description="Sender's phone number")
    store_type: Optional[str] = Field(None, max_length=255, description="Type of store")
    interest: Optional[str] = Field(None, description="What they are interested in")


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