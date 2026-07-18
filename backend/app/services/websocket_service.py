"""
WebSocket Service – High-level business logic for real-time features

This service wraps the low-level Socket.IO server (sio) and provides
convenience methods that can be called from REST endpoints, Celery tasks,
or other background workers.

All real-time event *handler* logic is in app/core/websocket_events.py.
"""

from typing import List, Optional, Dict, Any
from app.core.timezone import now as tz_now
import logging

from app.core.socket_manager import (
    sio,
    get_online_users,
    emit_to_user,
    emit_to_room,
    emit_broadcast,
    send_notification as _send_notification,
)
from app.schemas.websocket import (
    NotificationData,
    ChatMessageData,
    UserStatusData,
)

logger = logging.getLogger(__name__)


class WebSocketService:
    """
    Service layer for WebSocket operations.

    Provides methods that can be called from anywhere in the application
    (REST endpoints, Celery tasks, background workers) to push real-time
    events to connected clients.
    """

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------

    async def broadcast_notification(
        self,
        notification_data: NotificationData,
        target_user_id: Optional[str] = None,
        broadcast: bool = False,
    ) -> Dict[str, Any]:
        """
        Send a notification to one or all users.

        Args:
            notification_data: The notification payload.
            target_user_id: If set, send only to this user.
            broadcast: If True, send to **all** connected users.

        Returns:
            Result summary.
        """
        payload = notification_data.model_dump()

        if broadcast:
            await emit_broadcast("notification", payload)
            return {"sent_to": ["*broadcast*"], "failed": []}

        if target_user_id:
            await _send_notification(
                user_id=target_user_id,
                title=notification_data.title,
                message=notification_data.message,
                notification_type=notification_data.type,
                data=notification_data.data,
            )
            return {"sent_to": [target_user_id], "failed": []}

        return {"sent_to": [], "failed": ["No target specified"]}

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    async def send_chat_message(
        self,
        room_id: str,
        message_data: ChatMessageData,
        sender_id: str,
        sender_name: str,
    ) -> Dict[str, Any]:
        """
        Send a chat message to all members of a room.

        Args:
            room_id: The chat room (e.g. "chat_room:123").
            message_data: The message payload.
            sender_id:  Sender's user ID.
            sender_name: Sender's display name.

        Returns:
            Result summary.
        """
        message_data.sender_id = sender_id
        message_data.sender_name = sender_name
        message_data.timestamp = tz_now().isoformat()
        payload = message_data.model_dump()

        await emit_to_room(room_id, "chat_message", payload)
        return {"sent_to_room": room_id}

    # ------------------------------------------------------------------
    # User presence
    # ------------------------------------------------------------------

    async def get_user_status(self, user_id: str) -> Optional[UserStatusData]:
        """Check if a user is currently online."""
        online = await get_online_users()
        status = "online" if user_id in online else "offline"
        return UserStatusData(
            user_id=user_id,
            status=status,
        )

    async def get_online_users(self) -> List[str]:
        """Return list of online user IDs."""
        return await get_online_users()

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    async def get_socket_stats(self) -> Dict[str, Any]:
        """Return Socket.IO server statistics."""
        rooms = sio.manager.rooms.get("/", {}) if sio.manager else {}
        total_connections = sum(len(members) for members in rooms.values())
        user_rooms = {r for r in rooms if r.startswith("user:")}
        return {
            "total_connections": total_connections,
            "total_users_online": len(user_rooms),
            "total_rooms": len(rooms),
        }


# Singleton instance
websocket_service = WebSocketService()