"""
WebSocket message schemas

Defines Pydantic models for WebSocket message validation.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime


class AuthRequest(BaseModel):
    """Authentication request for WebSocket connection."""
    token: str = Field(..., description="JWT access token")


class AuthResponse(BaseModel):
    """Authentication response after successful connection."""
    success: bool = True
    user_id: str
    email: str
    username: str
    connected_at: str
    message: str = "Authenticated successfully"


class AuthError(BaseModel):
    """Authentication error response."""
    success: bool = False
    error: str
    code: str


class SubscribeRequest(BaseModel):
    """Request to subscribe to a room."""
    room: str = Field(..., description="Room identifier to join")


class UnsubscribeRequest(BaseModel):
    """Request to unsubscribe from a room."""
    room: str = Field(..., description="Room identifier to leave. Use '*' for all rooms.")


class NotificationData(BaseModel):
    """Notification message data."""
    id: Optional[str] = None
    type: str = Field(..., description="Notification type (message, alert, system, etc.)")
    title: str = Field(..., description="Notification title")
    message: str = Field(..., description="Notification body message")
    data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional data")
    created_at: Optional[str] = None


class SendNotificationRequest(BaseModel):
    """Request to send a notification."""
    to_user_id: Optional[str] = Field(None, description="Target user ID (for direct notification)")
    broadcast: bool = Field(False, description="Whether to broadcast to all users")
    type: str = Field(..., description="Notification type")
    title: str = Field(..., description="Notification title")
    message: str = Field(..., description="Notification message")
    data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional data")


class ChatMessageData(BaseModel):
    """Chat message data."""
    id: Optional[str] = None
    room_id: str = Field(..., description="Chat room identifier")
    sender_id: Optional[str] = None
    sender_name: Optional[str] = None
    message: str = Field(..., description="Message content")
    message_type: str = Field("text", description="Message type (text, image, file, etc.)")
    timestamp: Optional[str] = None
    attachments: List[Dict[str, Any]] = Field(default_factory=list, description="Message attachments")


class SendChatMessageRequest(BaseModel):
    """Request to send a chat message."""
    room_id: str = Field(..., description="Chat room identifier")
    message: str = Field(..., description="Message content")
    message_type: str = Field("text", description="Message type")
    attachments: List[Dict[str, Any]] = Field(default_factory=list)


class TypingIndicatorRequest(BaseModel):
    """Request for typing indicator."""
    room_id: str = Field(..., description="Chat room identifier")


class MarkMessagesReadRequest(BaseModel):
    """Request to mark messages as read."""
    room_id: str = Field(..., description="Chat room identifier")
    message_ids: List[str] = Field(..., description="List of message IDs to mark as read")


class UserStatusData(BaseModel):
    """User status/presence data."""
    user_id: str
    status: str = Field(..., description="online or offline")
    last_seen: Optional[str] = None


class RoomUpdateData(BaseModel):
    """Room update notification data."""
    room_id: str
    type: str = Field(..., description="user_joined, user_left, room_updated")
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    timestamp: Optional[str] = None


class ErrorResponse(BaseModel):
    """Generic error response."""
    success: bool = False
    error: str
    code: str
    details: Optional[Dict[str, Any]] = None


class SuccessResponse(BaseModel):
    """Generic success response."""
    success: bool = True
    message: str
    data: Optional[Dict[str, Any]] = None


class SocketStats(BaseModel):
    """Socket.IO server statistics."""
    total_connections: int
    total_users_online: int
    total_rooms: int
    connections_by_user: Dict[str, int]