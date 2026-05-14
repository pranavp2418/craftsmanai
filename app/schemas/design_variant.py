from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field


class DesignVariantBase(BaseModel):
    prompt_used: Optional[str] = None
    model_used: Optional[str] = None
    base_design_image_url: Optional[str] = None


class DesignVariantRefineRequest(DesignVariantBase):
    parent_variant_id: int = Field(..., ge=1)


class DesignVariantAnglesRequest(BaseModel):
    angles: Dict[str, str] = Field(..., description="Mapping of angle names to image URLs")


class DesignVariantMetalsRequest(BaseModel):
    metal_variations: Dict[str, str] = Field(..., description="Mapping of metal names to image URLs")


class DesignVariantSelectRequest(BaseModel):
    message: Optional[str] = None


class DesignVariantResponse(BaseModel):
    id: int
    design_id: int
    parent_variant_id: Optional[int]
    variant_name: str
    version_number: int
    base_design_image_url: Optional[str]
    angles_json: Optional[Dict[str, Any]]
    metal_variations_json: Optional[Dict[str, Any]]
    prompt_used: Optional[str]
    model_used: Optional[str]
    is_selected: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DesignVariantListResponse(BaseModel):
    items: List[DesignVariantResponse]
