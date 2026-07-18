"""Pydantic models supporting Server-Sent Events (SSE) functionality."""

from typing import Any, Optional, Dict
from pydantic import BaseModel, Field


class PublishEventRequest(BaseModel):
    """Schema used by REST endpoints or services to publish SSE events."""

    channel: str = Field(..., description="Logical channel name (e.g. job:123)")
    data: Any = Field(..., description="Payload to deliver to SSE subscribers")
    event: Optional[str] = Field(None, description="Optional custom event name")
    event_id: Optional[str] = Field(None, description="Event identifier for reconnection")
    retry: Optional[int] = Field(None, description="Client reconnection delay in milliseconds")
    comment: Optional[str] = Field(None, description="Optional comment/annotation")


class PublishEventResult(BaseModel):
    """Response payload for SSE publish operations."""

    success: bool
    delivered_to: int = Field(..., description="Number of subscribers that received the event")


class SSEStreamMeta(BaseModel):
    """Metadata returned on stream handshake."""

    channel: str
    heartbeat_interval: float
