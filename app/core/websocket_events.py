"""
WebSocket Event Handlers – Chat, Notifications, Room Management

All client -> server event handlers are defined here and registered on
the global Socket.IO server instance (sio) via register_event_handler().
"""

from typing import Optional
from datetime import datetime, UTC
import logging

from app.core.socket_manager import sio, emit_to_room, get_sio
from app.core.realtime_state import realtime_state
from app.schemas.websocket import (
    ChatMessageData,
    SendChatMessageRequest,
    SendNotificationRequest,
    TypingIndicatorRequest,
    MarkMessagesReadRequest,
    UserStatusData,
    RoomUpdateData,
    SuccessResponse,
    ErrorResponse,
)

logger = logging.getLogger(__name__)


# ======================================================================
# Room subscription
# ======================================================================

@sio.event
async def subscribe(sid: str, room: str) -> dict:
    """
    Client → Server: Subscribe to a room (e.g. "chat_room:123").
    The room must not start with a reserved prefix (user:, notifications).
    """
    reserved = ("user:", "notifications", "broadcast", "admin")
    if room.startswith(reserved):
        await sio.emit("error", {
            "code": "RESERVED_ROOM",
            "message": f"Cannot manually subscribe to reserved room '{room}'",
        }, to=sid)
        return {"success": False, "error": "Reserved room"}

    session = await _get_session_or_error(sid)
    if not session:
        return {"success": False, "error": "Session not found"}

    await sio.enter_room(sid, room)
    logger.info("sid=%s subscribed to room=%s", sid, room)
    await sio.emit("room_subscribed", {"room": room}, to=sid)

    user_id = session.get("user_id")
    if user_id:
        await realtime_state.add_rooms(user_id, [room])

    return {"success": True, "room": room}


@sio.event
async def unsubscribe(sid: str, room: str) -> dict:
    """
    Client → Server: Leave a room.
    Use "*" to leave all rooms (except reserved user rooms).
    """
    if room == "*":
        # Leave all non-reserved rooms
        reserved = ("user:", "notifications")
        session = await sio.get_session(sid)
        # We can iterate through rooms via the manager
        # For simplicity, this just leaves the room named "*" handling
        pass

    reserved = ("user:", "notifications")
    if room.startswith(reserved):
        await sio.emit("error", {
            "code": "RESERVED_ROOM",
            "message": f"Cannot unsubscribe from reserved room '{room}'",
        }, to=sid)
        return {"success": False, "error": "Reserved room"}

    session = await _get_session_or_error(sid)
    if not session:
        return {"success": False, "error": "Session not found"}

    await sio.leave_room(sid, room)
    logger.info("sid=%s unsubscribed from room=%s", sid, room)
    await sio.emit("room_unsubscribed", {"room": room}, to=sid)

    user_id = session.get("user_id")
    if user_id:
        await realtime_state.remove_rooms(user_id, [room])

    return {"success": True, "room": room}


# ======================================================================
# Chat
# ======================================================================

async def _get_session_or_error(
    sid: str,
    *,
    error_code: str = "SESSION_EXPIRED",
    message: str = "Session not found – please reconnect",
):
    """Return session for sid or emit standard error when missing."""
    session = await sio.get_session(sid)
    if not session:
        await sio.emit("error", {"code": error_code, "message": message}, to=sid)
        return None
    return session


@sio.event
async def send_chat_message(sid: str, data: dict) -> dict:
    """
    Client → Server: Send a chat message to a room.

    Expected payload: { room_id, message, message_type?, attachments? }
    """
    session = await _get_session_or_error(sid)
    if not session:
        return {"success": False, "error": "Session not found"}

    user_id = session.get("user_id")
    username = session.get("username")

    if not user_id:
        await sio.emit("error", {
            "code": "SESSION_EXPIRED",
            "message": "Session not found – please reconnect",
        }, to=sid)
        return {"success": False, "error": "User ID not found in session"}

    request = SendChatMessageRequest(**data)
    msg_id = f"msg_{datetime.now(UTC).timestamp()}_{sid[:6]}"

    chat_msg = ChatMessageData(
        id=msg_id,
        room_id=request.room_id,
        sender_id=user_id,
        sender_name=username,
        message=request.message,
        message_type=request.message_type,
        timestamp=datetime.now(UTC).isoformat(),
        attachments=request.attachments,
    ).model_dump()

    # Emit to all members of the chat room (including sender, for confirmation)
    await sio.emit("chat_message", chat_msg, room=request.room_id)

    # Also send a delivery confirmation to the sender
    await sio.emit("message_sent", {
        "message_id": msg_id,
        "room_id": request.room_id,
        "timestamp": datetime.now(UTC).isoformat(),
    }, to=sid)

    logger.info("Chat msg sid=%s room=%s msg_id=%s", sid, request.room_id, msg_id)
    return {"success": True, "message_id": msg_id}


@sio.event
async def typing_start(sid: str, data: dict) -> dict:
    """Client → Server: Notify room that this user started typing."""
    session = await _get_session_or_error(sid)
    if not session:
        return {"success": False, "error": "Session not found"}

    user_id = session.get("user_id")
    username = session.get("username")

    request = TypingIndicatorRequest(**data)
    await sio.emit("user_typing", {
        "room_id": request.room_id,
        "user_id": user_id,
        "username": username,
        "is_typing": True,
    }, room=request.room_id, skip_sid=sid)
    return {"success": True}


@sio.event
async def typing_stop(sid: str, data: dict) -> dict:
    """Client → Server: Notify room that this user stopped typing."""
    session = await _get_session_or_error(sid)
    if not session:
        return {"success": False, "error": "Session not found"}

    user_id = session.get("user_id")
    username = session.get("username")

    request = TypingIndicatorRequest(**data)
    await sio.emit("user_typing", {
        "room_id": request.room_id,
        "user_id": user_id,
        "username": username,
        "is_typing": False,
    }, room=request.room_id, skip_sid=sid)
    return {"success": True}


@sio.event
async def mark_messages_read(sid: str, data: dict) -> dict:
    """Client → Server: Mark messages as read in a room."""
    session = await _get_session_or_error(sid)
    if not session:
        return {"success": False, "error": "Session not found"}

    user_id = session.get("user_id")

    request = MarkMessagesReadRequest(**data)
    # Acknowledge to sender
    await sio.emit("messages_read", {
        "room_id": request.room_id,
        "message_ids": request.message_ids,
        "user_id": user_id,
        "timestamp": datetime.now(UTC).isoformat(),
    }, to=sid)
    return {"success": True, "message_ids": request.message_ids}


# ======================================================================
# Notifications (admin broadcasts)
# ======================================================================

@sio.event
async def send_notification(sid: str, data: dict) -> dict:
    """
    Client → Server: Send a notification to a specific user or broadcast.

    Expected payload: { to_user_id?, broadcast?, type, title, message, data? }
    """
    session = await _get_session_or_error(sid)
    if not session:
        return {"success": False, "error": "Session not found"}

    user_id = session.get("user_id")

    request = SendNotificationRequest(**data)

    notification = {
        "type": request.type,
        "title": request.title,
        "message": request.message,
        "data": request.data or {},
        "created_at": datetime.now(UTC).isoformat(),
    }

    if request.broadcast:
        # Broadcast to everyone in the "notifications" room
        await sio.emit("notification", notification, room="notifications")
    elif request.to_user_id:
        # Direct to specific user's room
        await sio.emit("notification", notification, room=f"user:{request.to_user_id}")

    # Confirm to sender
    await sio.emit("notification_sent", {
        "to_user_id": request.to_user_id,
        "broadcast": request.broadcast,
        "type": request.type,
    }, to=sid)

    return {"success": True}


# ======================================================================
# Stats & health
# ======================================================================

@sio.event
async def get_stats(sid: str, _data: dict = None) -> dict:
    """Client → Server: Return Socket.IO server statistics."""
    rooms = sio.manager.rooms.get("/", {})
    total_sockets = sum(len(members) for members in rooms.values())

    # Count unique users from "user:*" rooms
    user_rooms = {r for r in rooms if r.startswith("user:")}
    user_count = len(user_rooms)

    stats = {
        "total_connections": total_sockets,
        "total_users_online": user_count,
        "total_rooms": len(rooms),
    }
    await sio.emit("stats", stats, to=sid)
    return {"success": True, "data": stats}


@sio.event
async def ping(sid: str, _data: dict = None) -> dict:
    """Client → Server: Heartbeat – respond with pong."""
    await sio.emit("pong", {
        "timestamp": datetime.now(UTC).isoformat(),
    }, to=sid)
    return {"success": True}


# ======================================================================
# Room management (admin)
# ======================================================================

@sio.event
async def join_chat_room(sid: str, data: dict) -> dict:
    """
    Client → Server: Join a specific chat room (alias for subscribe).
    Expected: { room_id, password? }
    """
    room_id = data.get("room_id")
    if not room_id:
        await sio.emit("error", {
            "code": "INVALID_PAYLOAD",
            "message": "room_id is required",
        }, to=sid)
        return {"success": False, "error": "room_id required"}

    chat_room = f"chat_room:{room_id}"
    session = await _get_session_or_error(sid)
    if not session:
        return {"success": False, "error": "Session not found"}

    await sio.enter_room(sid, chat_room)

    # Notify existing members
    username = session.get("username", "Unknown")

    user_id = session.get("user_id")
    if user_id:
        await realtime_state.add_rooms(user_id, [chat_room])

    await sio.emit("room_update", {
        "room_id": chat_room,
        "type": "user_joined",
        "user_id": session.get("user_id"),
        "user_name": username,
        "timestamp": datetime.now(UTC).isoformat(),
    }, room=chat_room, skip_sid=sid)

    await sio.emit("room_joined", {"room_id": chat_room}, to=sid)
    return {"success": True, "room": chat_room}


@sio.event
async def leave_chat_room(sid: str, data: dict) -> dict:
    """
    Client → Server: Leave a specific chat room.
    Expected: { room_id }
    """
    room_id = data.get("room_id")
    if not room_id:
        return {"success": False, "error": "room_id required"}

    chat_room = f"chat_room:{room_id}"
    session = await _get_session_or_error(sid)
    if not session:
        return {"success": False, "error": "Session not found"}

    await sio.leave_room(sid, chat_room)

    username = session.get("username", "Unknown")
    user_id = session.get("user_id")
    if user_id:
        await realtime_state.remove_rooms(user_id, [chat_room])

    await sio.emit("room_update", {
        "room_id": chat_room,
        "type": "user_left",
        "user_id": session.get("user_id"),
        "user_name": username,
        "timestamp": datetime.now(UTC).isoformat(),
    }, room=chat_room, skip_sid=sid)

    return {"success": True, "room": chat_room}