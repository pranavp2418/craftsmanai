from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field


class DesignVariantBase(BaseModel):
    model_config = {"protected_namespaces": ()}

    prompt_used: Optional[str] = None
    model_used: Optional[str] = None
    base_design_image_url: Optional[str] = None


class DesignVariantRefineRequest(DesignVariantBase):
    style_tags: Optional[str] = Field(None, description="List of style tags to guide the refinement")
    design_focus: Optional[str] = Field(None, description="Specific area of the design to focus on (e.g. 'ring band', 'gemstone')", max_length=100)

    parent_variant_id: int = Field(..., ge=1)


class DesignVariantAnglesRequest(BaseModel):
    angles: Dict[str, str] = Field(..., description="Mapping of angle names to image URLs")


class DesignVariantAngleGenerationRequest(BaseModel):
    """Request to generate viewing angles per metal type via background AI task.

    Accepts a list of metals (e.g. ``["gold", "silver", "rose"]``).
    For each metal, all standard viewing angles (side, top, three-quarter)
    are generated and stored in a nested structure under ``angles_json``.
    """

    metals: List[str] = Field(
        ...,
        description="List of metal types to generate angles for (e.g. gold, silver, rose)",
    )


class DesignVariantMetalGenerationRequest(BaseModel):
    """Request to generate metal variant images via background AI task.

    Accepts a list of metals (e.g. ``["gold", "silver", "rose_gold"]``).
    The images are generated asynchronously and the variant's
    ``metal_variations_json`` is updated once complete.
    """

    metals: List[str] = Field(
        ...,
        description="List of metal types to generate (e.g. gold, silver, rose_gold, platinum, white_gold)",
    )


class DesignVariantMetalsRequest(BaseModel):
    metal_variations: Dict[str, str] = Field(..., description="Mapping of metal names to image URLs")


class DesignVariantSelectRequest(BaseModel):
    message: Optional[str] = None


class DesignVariantResponse(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}

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


class PaginationMetadata(BaseModel):
    page: int
    limit: int
    total_items: int
    total_pages: int
    has_next: bool
    has_prev: bool


class DesignVariantListResponse(BaseModel):
    items: List[DesignVariantResponse]
    pagination: Optional[PaginationMetadata] = None
