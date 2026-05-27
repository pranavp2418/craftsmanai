"""
Pydantic schemas for notification API.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    """Schema for a single notification returned to the client."""
    id: int
    user_id: int
    type: str
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    is_read: bool
    read_at: Optional[datetime] = None
    source: Optional[str] = None
    reference_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list."""
    items: List[NotificationResponse]
    total: int
    unread_count: int
    limit: int
    offset: int


class UnreadCountResponse(BaseModel):
    """Schema for unread notification count."""
    unread_count: int


class MarkReadResponse(BaseModel):
    """Schema after marking notifications as read."""
    success: bool
    marked_count: int