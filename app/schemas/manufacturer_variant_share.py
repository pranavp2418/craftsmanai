from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.design import DesignStatus
from app.schemas.manufacturer import ManufacturerResponse


class ManufacturerVariantShareRequest(BaseModel):
    """Request to share a design variant with a list of manufacturers for quoting.

    Note: The variant must be shared with a customer first. The manufacturers
    will automatically see the same metal that was shared with the customer.
    """

    manufacturer_ids: list[int] = Field(..., min_length=1, description="List of IDs of the manufacturers to share with")


class ManufacturerVariantShareResponse(BaseModel):
    id: int
    design_variant_id: int
    manufacturer_id: int
    public_token: str
    review_url: Optional[str] = None
    status: str
    cost_price: Optional[float] = None
    delivery_time_days: Optional[int] = None
    notes: Optional[str] = None
    shared_metal: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ManufacturerVariantShareDetailResponse(BaseModel):
    id: int
    design_variant_id: int
    manufacturer_id: int
    manufacturer: Optional[ManufacturerResponse] = None
    shared_date: Optional[datetime] = None
    quote_id: Optional[int] = None
    quoted_price: Optional[float] = None
    estimated_delivery_days: Optional[int] = None
    estimated_delivery_date: Optional[datetime] = None
    manufacturer_notes: Optional[str] = None
    status: str
    public_token: str
    shared_metal: Optional[str] = None

    class Config:
        from_attributes = True


class VariantManufacturerSharesResponse(BaseModel):
    variant_id: int
    variant_name: str
    version_number: int
    design_id: int
    design_code: str
    design_name:Optional[str] = None
    design_variant_status: DesignStatus
    design_status: DesignStatus
    total_shares: int
    shares: list[ManufacturerVariantShareDetailResponse]


class ManufacturerQuoteSubmitRequest(BaseModel):
    """Manufacturer submits a quote for a shared design variant."""

    share_token: str = Field(..., min_length=1, description="The share token for the variant")
    cost_price: float = Field(..., ge=0, description="Quoted cost price")
    delivery_time_days: int = Field(..., ge=1, description="Estimated delivery time in days")
    notes: Optional[str] = Field(default=None, description="Additional notes about the quote")

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


class ResendShareItem(BaseModel):
    """Per-share entry returned by the resend manufacturer emails endpoint."""

    share_id: int
    manufacturer_id: int
    status: str
    task_id: Optional[str] = None
    review_url: Optional[str] = None
    message: Optional[str] = None


class ResendManufacturerEmailsResponse(BaseModel):
    """Response returned by the resend manufacturer emails endpoint."""

    variant_id: int
    total_shares: int
    queued_count: int
    skipped_count: int
    background: bool = True
    message: str
    items: list[ResendShareItem]
