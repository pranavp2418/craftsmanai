"""
WebSocket Router – Socket.IO ASGI application mount point

This module creates a socket.io.ASGIApp that wraps the global Socket.IO
server (sio).  FastAPI's app.mount() attaches it so Socket.IO clients
connect at the configured path (default: /ws/socket.io).

All event handlers live in app/core/websocket_events.py and are registered
automatically via the @sio.event decorators.

Additionally, REST endpoints for status / user presence are exposed here
for convenience.
"""

from fastapi import APIRouter, HTTPException
import logging

from app.core.socket_manager import sio, get_online_users, emit_to_user, send_notification
from app.schemas.websocket import SocketStats

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# REST endpoints for status / presence
# ---------------------------------------------------------------------------


@router.get("/ws/status")
async def websocket_status():
    """
    Get Socket.IO server status and statistics.

    Returns information about active connections, online users, and rooms.
    """
    rooms = sio.manager.rooms.get("/", {}) if hasattr(sio, "manager") and sio.manager else {}
    total_connections = sum(len(members) for members in rooms.values())
    user_rooms = {r for r in rooms if r.startswith("user:")}

    return {
        "status": "online",
        "websocket_enabled": True,
        "stats": SocketStats(
            total_connections=total_connections,
            total_users_online=len(user_rooms),
            total_rooms=len(rooms),
            connections_by_user={},
        ).model_dump(),
    }


@router.get("/user/{user_id}/status")
async def get_user_status(user_id: str):
    """
    Get online/offline status for a specific user.

    Args:
        user_id: User identifier

    Returns:
        User status information
    """
    online_users = await get_online_users()
    is_online = user_id in online_users
    return {
        "success": True,
        "data": {
            "user_id": user_id,
            "status": "online" if is_online else "offline",
        },
    }


@router.get("/users/online")
async def get_online_users_endpoint():
    """
    Get list of all online users.

    Returns:
        List of online user IDs
    """
    users = await get_online_users()
    return {
        "success": True,
        "data": {
            "online_users": users,
            "count": len(users),
        },
    }


# ---------------------------------------------------------------------------
# REST endpoint to push notifications (used by Celery tasks, APIs, etc.)
# ---------------------------------------------------------------------------


@router.post("/notify/user/{user_id}")
async def notify_user(
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "general",
):
    """
    Send a real-time notification to a specific user via REST.

    This is typically called from Celery tasks or other backend services.
    """
    await send_notification(user_id, title, message, notification_type)
    return {"success": True, "message": f"Notification sent to user {user_id}"}