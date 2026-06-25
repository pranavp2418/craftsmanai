"""
Email Template Schemas

Pydantic schemas for email template validation and serialization.
"""

from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from uuid import UUID

from app.core.sanitizer import validate_and_sanitize


class EmailTemplateBase(BaseModel):
    """Base schema for email template."""
    key: str = Field(..., min_length=1, max_length=100, description="Unique template identifier")
    description: Optional[str] = Field(None, max_length=255, description="Template description")
    subject: str = Field(..., min_length=1, max_length=255, description="Email subject line")
    html_content: str = Field(..., description="HTML body content")
    text_content: Optional[str] = Field(None, description="Plain text body content")
    is_active: bool = Field(True, description="Whether the template is active")

    @field_validator('key', 'subject')
    @classmethod
    def validate_text_fields(cls, v: str) -> str:
        """Sanitize text fields to prevent XSS"""
        return validate_and_sanitize(v, field_type="plain", max_length=255)
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize description to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=255)


class EmailTemplateCreate(EmailTemplateBase):
    """Schema for creating a new email template."""
    pass


class EmailTemplateUpdate(BaseModel):
    """Schema for updating an email template."""
    description: Optional[str] = Field(None, max_length=255)
    subject: Optional[str] = Field(None, min_length=1, max_length=255)
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('subject')
    @classmethod
    def validate_subject(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize subject to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=255)
    
    @field_validator('description')
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize description to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=255)


class EmailTemplateResponse(EmailTemplateBase):
    """Schema for email template response."""
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmailTemplateListResponse(BaseModel):
    """Schema for listing email templates."""
    success: bool = True
    total: int
    templates: list[EmailTemplateResponse]


class EmailTemplateDeleteResponse(BaseModel):
    """Schema for email template deletion response."""
    success: bool
    message: str