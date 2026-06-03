from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field

from app.models.design import DesignStatus, DesignShareStatus
from app.schemas.design_variant import PaginationMetadata


class DesignBase(BaseModel):
    name: Optional[str] = None
    jewellery_type: Optional[str] = None
    user_prompt: Optional[str] = None
    input_image_url: Optional[str] = None


class DesignCreateRequest(DesignBase):
    name: str = Field(..., min_length=1)
    jewellery_type: str = Field(..., min_length=1)
    user_prompt: str = Field(..., min_length=1)
    images:Optional [list[str]] = Field(default=None, min_items=1, max_items=10)


class DesignUpdateRequest(DesignBase):
    status: Optional[DesignStatus] = None


class DesignVariantListItem(BaseModel):
    """Lightweight variant representation for design list responses."""
    # id: int
    # design_id: int
    # parent_variant_id: Optional[int] = None
    # variant_name: str
    # version_number: int
    base_design_image_url: Optional[str] = None
    # angles_json: Optional[Dict[str, Any]] = None
    # metal_variations_json: Optional[Dict[str, Any]] = None
    # prompt_used: Optional[str] = None
    # model_used: Optional[str] = None
    # is_selected: bool = False
    # is_archived: bool = False
    # design_focus: Optional[str] = None
    # style_tags: Optional[str] = None
    # created_at: datetime

    class Config:
        from_attributes = True


class SharedCustomerInfo(BaseModel):
    """Customer information when a design variant has been shared to a customer.
    A design variant can only be shared to one customer, so only a single entry is returned."""
    customer_name: str
    public_token: str
    share_status: DesignShareStatus
    share_comment: Optional[str] = None

    class Config:
        from_attributes = True


class DesignResponse(BaseModel):
    id: int
    user_id: int
    created_by_user_id: Optional[int] = None
    design_code: str
    sequence_number: int
    name: str
    jewellery_type: Optional[str]
    user_prompt: Optional[str]
    input_image_url: Optional[str]
    input_image_urls: Optional[list[str]]
    status: DesignStatus
    created_at: datetime
    updated_at: Optional[datetime]
    base_image_url: Optional[str] = None
    variants: List[DesignVariantListItem] = Field(default=[], description="First (most recent) non-archived variant of this design")
    shared_customer: Optional[SharedCustomerInfo] = Field(default=None, description="Customer info if this design's variant has been shared (max one)")

    class Config:
        from_attributes = True


class DesignRestoreResponse(BaseModel):
    id: int
    message: str


class DesignListResponse(BaseModel):
    items: List[DesignResponse]
    total: int
    pagination: Optional[PaginationMetadata] = None


class DesignShareCreateRequest(BaseModel):

    customer_id: Optional[int] = None
    comment: Optional[str] = None
    metal: Optional[str] = Field(
        default=None,
        description="Specific metal to share with the customer (e.g. 'gold', 'rose_gold', 'silver'). "
                    "When set, further manufacturer shares will use the same metal.",
    )


class DesignShareResponse(BaseModel):
    id: int
    design_variant_id: int
    customer_id: Optional[int]
    public_token: str
    status: DesignShareStatus
    comment: Optional[str]
    shared_metal: Optional[str] = None
    reviewed_at: Optional[datetime]
    created_at: datetime
   

    class Config:
        from_attributes = True


class DesignShareStatusUpdateRequest(BaseModel):
    status: DesignShareStatus
    comment: Optional[str] = None


class ActivityLogEntry(BaseModel):
    id: int
    action_type: str
    message: Optional[str]
    metadata_json: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class ActivityLogListResponse(BaseModel):
    items: List[ActivityLogEntry]