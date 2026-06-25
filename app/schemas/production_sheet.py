from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator

from app.core.sanitizer import validate_and_sanitize


class ProductionSheetCreateRequest(BaseModel):
    budget_range: str = Field(..., min_length=1, max_length=100)
    metal_details: Optional[Any] = None
    stone_type: Optional[str] = Field(default=None, max_length=100)
    setting_type: Optional[str] = Field(default=None, max_length=100)
    stone_count: Optional[int] = Field(default=None, ge=0)
    stone_size: Optional[str] = Field(default=None, max_length=100)
    dimension: Optional[Any] = None
    manufacturing_notes: Optional[str] = None
    # manufacturing_image is handled as a file upload in the endpoint; response returns its URL

    @field_validator('budget_range', 'stone_type', 'setting_type', 'stone_size', 'manufacturing_notes')
    @classmethod
    def validate_text_fields(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize text fields to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=1000)


class ProductionSheetDraftRequest(BaseModel):
    budget_range: Optional[str] = Field(default=None, max_length=100)
    metal_details: Optional[Any] = None
    stone_type: Optional[str] = Field(default=None, max_length=100)
    setting_type: Optional[str] = Field(default=None, max_length=100)
    stone_count: Optional[int] = Field(default=None, ge=0)
    stone_size: Optional[str] = Field(default=None, max_length=100)
    dimension: Optional[Any] = None
    manufacturing_notes: Optional[str] = None

    @field_validator('budget_range', 'stone_type', 'setting_type', 'stone_size', 'manufacturing_notes')
    @classmethod
    def validate_text_fields(cls, v: Optional[str]) -> Optional[str]:
        """Sanitize text fields to prevent XSS"""
        if v is None:
            return v
        return validate_and_sanitize(v, field_type="plain", max_length=1000)


class ProductionSheetResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    variant_id: int
    budget_range: Optional[str]
    metal_details: Optional[Any]
    stone_type: Optional[str]
    setting_type: Optional[str]
    stone_count: Optional[int]
    stone_size: Optional[str]
    dimension: Optional[Any]
    manufacturing_notes: Optional[str]
    manufacturing_image: Optional[str]
