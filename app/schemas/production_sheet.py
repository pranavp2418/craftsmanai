from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


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


class ProductionSheetDraftRequest(BaseModel):
    budget_range: Optional[str] = Field(default=None, max_length=100)
    metal_details: Optional[Any] = None
    stone_type: Optional[str] = Field(default=None, max_length=100)
    setting_type: Optional[str] = Field(default=None, max_length=100)
    stone_count: Optional[int] = Field(default=None, ge=0)
    stone_size: Optional[str] = Field(default=None, max_length=100)
    dimension: Optional[Any] = None
    manufacturing_notes: Optional[str] = None


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
