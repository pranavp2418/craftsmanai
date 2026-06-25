from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, field_validator

from app.models.order import OrderStatus, ManufacturerQuoteStatus


class OrderCreateRequest(BaseModel):
    """Request to create an order from a selected design variant.

    Only ``design_variant_id`` and ``customer_id`` are required.
    The ``share_id`` is automatically resolved:
      - If a ``DesignShare`` already exists for this design + customer it is
        re-used; otherwise a new share is created.
    """

    design_variant_id: int = Field(..., ge=1)
    customer_id: int = Field(..., ge=1)


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
    page: int
    limit: int = 20
    total_pages: int = 1
    has_next: bool = False
    has_prev: bool = False


class ManufacturerQuoteSubmitRequest(BaseModel):
    order_id: int = Field(..., ge=1)
    manufacturer_id: int = Field(..., ge=1)
    cost_price: Optional[float] = Field(default=None, ge=0)
    delivery_time_days: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None

    @field_validator('cost_price', mode='before')
    @classmethod
    def validate_cost_price_digits_only(cls, v):
        """Validate that cost_price contains only digits and optionally a decimal point."""
        if v is None:
            return v
        v_str = str(v).strip()
        if not v_str:
            return v
        # Allow digits and single decimal point for cost_price
        if not all(c.isdigit() or c == '.' for c in v_str):
            raise ValueError('cost_price must contain only digits, no letters allowed')
        return v

    @field_validator('delivery_time_days', mode='before')
    @classmethod
    def validate_delivery_time_digits_only(cls, v):
        """Validate that delivery_time_days contains only digits."""
        if v is None:
            return v
        v_str = str(v).strip()
        if not v_str:
            return v
        # Only digits allowed for delivery_time_days (no decimal point)
        if not all(c.isdigit() for c in v_str):
            raise ValueError('delivery_time_days must contain only digits, no letters allowed')
        return v


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


class ManufacturerQuoteDetailResponse(ManufacturerQuoteResponse):
    manufacturer_name: Optional[str]
    metal: Optional[str]
    
    class Config:
        from_attributes = True


class ManufacturerQuoteListResponse(BaseModel):
    items: List[ManufacturerQuoteResponse]


class ManufacturerQuoteDetailListResponse(BaseModel):
    items: List[ManufacturerQuoteDetailResponse]


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


class OrderCreateResponse(BaseModel):
    """Response returned by the order creation endpoint.

    Includes the created order plus the resolved share details.
    """

    order: OrderResponse
    share_id: int
    design_id: int

    class Config:
        from_attributes = True