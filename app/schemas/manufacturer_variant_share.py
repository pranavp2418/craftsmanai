from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

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
    design_name: str
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