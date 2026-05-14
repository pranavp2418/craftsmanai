from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field


class ManufacturerCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    company_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    location: Optional[str] = None


class ManufacturerUpdateRequest(BaseModel):
    name: Optional[str]
    company_name: Optional[str]
    email: Optional[EmailStr]
    phone: Optional[str]
    address: Optional[str]
    location: Optional[str]
    is_active: Optional[bool]


class ManufacturerResponse(BaseModel):
    id: int
    created_by_user_id: int
    name: str
    company_name: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    location: Optional[str]
    public_token: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ManufacturerListResponse(BaseModel):
    items: List[ManufacturerResponse]
    total: int
