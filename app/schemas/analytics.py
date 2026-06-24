from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator


class ActivityLogFilter(BaseModel):
    """Validation schema for activity log filter parameter"""
    actor_type: Optional[str] = Field(
        default=None,
        description="Filter by actor type: manufacturer or customer"
    )
    page: int = Field(
        default=1,
        ge=1,
        description="Page number"
    )
    page_size: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Items per page"
    )


class MetricsFilter(BaseModel):
    """Validation schema for metrics time range"""
    months: int = Field(
        default=6,
        ge=1,
        le=24,
        description="Number of months to look back (1-24)"
    )


class DateRangeFilter(BaseModel):
    """Validation schema for date range filters"""
    start_date: Optional[datetime] = Field(
        None,
        description="Start date for filtering (ISO format)"
    )
    end_date: Optional[datetime] = Field(
        None,
        description="End date for filtering (ISO format)"
    )

    @validator("end_date")
    def validate_date_range(cls, end_date, values):
        start_date = values.get("start_date")
        if start_date and end_date and end_date < start_date:
            raise ValueError("end_date must be after start_date")
        return end_date

    @validator("start_date", "end_date")
    def validate_future_dates(cls, value):
        if value and value > datetime.now(value.tzinfo or None):
            raise ValueError("Date cannot be in the future")
        return value


class JewelleryBreakdownFilter(BaseModel):
    """Validation schema for jewellery breakdown"""
    months: int = Field(
        default=6,
        ge=1,
        le=24,
        description="Number of months to look back (1-24)"
    )


class ConversionFunnelFilter(BaseModel):
    """Validation schema for conversion funnel"""
    months: int = Field(
        default=6,
        ge=1,
        le=24,
        description="Number of months to look back (1-24)"
    )


class CompletedOrdersFilter(BaseModel):
    """Validation schema for completed orders"""
    months: int = Field(
        default=6,
        ge=1,
        le=24,
        description="Number of months to look back (1-24)"
    )


class DesignTimeFilter(BaseModel):
    """Validation schema for design time metrics"""
    months: int = Field(
        default=6,
        ge=1,
        le=24,
        description="Number of months to look back (1-24)"
    )


class AnalyticsErrorResponse(BaseModel):
    """Standardized error response for analytics endpoints"""
    success: bool = False
    error: str
    detail: Optional[str] = None
    timestamp: datetime