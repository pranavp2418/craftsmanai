from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field


class CustomerCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None


class CustomerUpdateRequest(BaseModel):
    name: Optional[str]
    email: Optional[EmailStr]
    phone: Optional[str]
    company_name: Optional[str]
    address: Optional[str]
    is_active: Optional[bool]


class CustomerResponse(BaseModel):
    id: int
    created_by_user_id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    company_name: Optional[str]
    address: Optional[str]
    public_token: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    items: List[CustomerResponse]
    total: int
