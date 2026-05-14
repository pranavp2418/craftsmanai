from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field

from app.models.order import OrderStatus, ManufacturerQuoteStatus


class OrderCreateRequest(BaseModel):
    design_id: int = Field(..., ge=1)
    share_id: Optional[int] = Field(default=None, ge=1)
    customer_id: Optional[int] = Field(default=None, ge=1)


class OrderStatusUpdateRequest(BaseModel):
    status: OrderStatus
    message: Optional[str] = None


class OrderResponse(BaseModel):
    id: int
    design_id: int
    share_id: Optional[int]
    customer_id: Optional[int]
    current_manufacturer_id: Optional[int]
    status: OrderStatus
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int


class ManufacturerQuoteSubmitRequest(BaseModel):
    order_id: int = Field(..., ge=1)
    manufacturer_id: int = Field(..., ge=1)
    cost_price: Optional[float] = Field(default=None, ge=0)
    delivery_time_days: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None


class ManufacturerQuoteStatusUpdateRequest(BaseModel):
    status: ManufacturerQuoteStatus
    message: Optional[str] = None


class ManufacturerQuoteResponse(BaseModel):
    id: int
    order_id: int
    manufacturer_id: int
    cost_price: Optional[float]
    delivery_time_days: Optional[int]
    notes: Optional[str]
    status: ManufacturerQuoteStatus
    created_at: datetime

    class Config:
        from_attributes = True


class ManufacturerQuoteListResponse(BaseModel):
    items: List[ManufacturerQuoteResponse]


class OrderActivityLogEntry(BaseModel):
    id: int
    action_type: str
    message: Optional[str]
    metadata_json: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class OrderActivityLogListResponse(BaseModel):
    items: List[OrderActivityLogEntry]
