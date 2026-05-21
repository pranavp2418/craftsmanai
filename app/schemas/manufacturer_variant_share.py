from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ManufacturerVariantShareRequest(BaseModel):
    """Request to share a design variant with a manufacturer for quoting."""

    manufacturer_id: int = Field(..., ge=1, description="ID of the manufacturer to share with")


class ManufacturerVariantShareResponse(BaseModel):
    id: int
    design_variant_id: int
    manufacturer_id: int
    public_token: str
    status: str
    cost_price: Optional[float] = None
    delivery_time_days: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ManufacturerQuoteSubmitRequest(BaseModel):
    """Manufacturer submits a quote for a shared design variant."""

    share_token: str = Field(..., min_length=1, description="The share token for the variant")
    cost_price: float = Field(..., ge=0, description="Quoted cost price")
    delivery_time_days: int = Field(..., ge=1, description="Estimated delivery time in days")
    notes: Optional[str] = Field(default=None, description="Additional notes about the quote")