from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field

from app.models.design import DesignStatus, DesignShareStatus


class DesignBase(BaseModel):
    name: Optional[str] = None
    jewellery_type: Optional[str] = None
    user_prompt: Optional[str] = None
    input_image_url: Optional[str] = None


class DesignCreateRequest(DesignBase):
    name: str = Field(..., min_length=1)
    jewellery_type: str = Field(..., min_length=1)
    user_prompt: str = Field(..., min_length=1)
    images: list[str] = Field(..., min_items=1, max_items=10)


class DesignUpdateRequest(DesignBase):
    status: Optional[DesignStatus] = None


class DesignResponse(BaseModel):
    id: int
    user_id: int
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

    class Config:
        from_attributes = True


class DesignListResponse(BaseModel):
    items: List[DesignResponse]
    total: int


class DesignShareCreateRequest(BaseModel):
    customer_id: Optional[int] = None
    comment: Optional[str] = None


class DesignShareResponse(BaseModel):
    id: int
    design_variant_id: int
    customer_id: Optional[int]
    public_token: str
    status: DesignShareStatus
    comment: Optional[str]
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
