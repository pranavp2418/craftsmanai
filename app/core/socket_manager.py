"""
Socket.IO Server Manager - Central WebSocket engine for the entire application

This module provides the single Socket.IO server instance that handles ALL
real-time communication: notifications, live chat, presence, etc.

Architecture:
    - One Socket.IO server mounted on FastAPI via ASGI
    - Redis adapter for horizontal scaling (optional)
    - JWT-based authentication on connect
    - Room-based event routing
    - Automatic user presence tracking
"""

from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, UTC
import logging
import urllib.parse

import socketio
from socketio import AsyncServer, AsyncRedisManager

from app.core.config import settings
from app.core.jwt import decode_access_token
from app.core.realtime_state import SessionData, realtime_state

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Token extraction: from auth dict OR from query string (Postman support)
# ---------------------------------------------------------------------------

def _extract_token(auth: Optional[dict], environ: dict) -> Optional[str]:
    """
    Extract JWT token from either:
    1. `auth["token"]` — standard Socket.IO client auth
    2. `?token=...` query parameter — for Postman / raw WebSocket clients
    """
    # Method 1: Socket.IO auth dict
    if auth and "token" in auth:
        return auth["token"]

    # Method 2: Query string (Postman / raw WebSocket).
    # socketio passes environ which follows PEP 3333 (WSGI).
    # The key may also be lowercase depending on the driver.
    raw_qs = environ.get("QUERY_STRING") or environ.get("query_string", "")
    if isinstance(raw_qs, bytes):
        raw_qs = raw_qs.decode("utf-8", errors="replace")
    params = urllib.parse.parse_qs(raw_qs)
    token_list = params.get("token")
    if token_list:
        logger.debug("Token extracted from query string, len=%d", len(token_list[0]))
        return token_list[0]

    # Method 3: ASGI scope query_string (passed as bytes in 'asgi.scope')
    asgi_scope = environ.get("asgi.scope", {})
    raw_bytes = asgi_scope.get("query_string", b"")
    if isinstance(raw_bytes, bytes) and raw_bytes:
        raw_qs = raw_bytes.decode("utf-8", errors="replace")
        params = urllib.parse.parse_qs(raw_qs)
        token_list = params.get("token")
        if token_list:
            logger.debug("Token extracted from asgi.scope query_string")
            return token_list[0]

    logger.debug(
        "No token in auth=%s, query_string=%s",
        auth,
        raw_qs[:80] if raw_qs else "(empty)",
    )
    return None


def _authenticate(token: str) -> Optional[dict]:
    """
    Validate a JWT token and return user info.

    Returns:
        dict with user_id/email/username if valid, None otherwise.
    """
    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        logger.warning("JWT payload missing 'sub' claim")
        return None

    email = payload.get("email") or payload.get("email_address")
    username = payload.get("username") or payload.get("name")

    user_id_str = str(user_id)
    email_str = str(email) if email else ""
    username_str = str(username) if username else (email_str or user_id_str)

    return {
        "user_id": user_id_str,
        "email": email_str,
        "username": username_str,
        "payload": payload,
    }


# ---------------------------------------------------------------------------
# Redis adapter helper
# ---------------------------------------------------------------------------

def _create_redis_manager() -> Optional[AsyncRedisManager]:
    """Create a Redis-based Socket.IO adapter if configured."""
    if not settings.SOCKETIO_REDIS_ADAPTER:
        return None
    try:
        from socketio import AsyncRedisManager as _ARM
        return _ARM(settings.REDIS_URL)
    except Exception as exc:
        logger.warning("Redis adapter unavailable – falling back to in-process: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Single global Socket.IO server
# ---------------------------------------------------------------------------

sio: AsyncServer = AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.SOCKETIO_CORS_ALLOWED_ORIGINS,
    logger=logger.level <= logging.DEBUG,
    engineio_logger=logger.level <= logging.DEBUG,
)


# Attach Redis manager for horizontal scaling (if enabled)
_redis_mgr = _create_redis_manager()
if _redis_mgr:
    sio.manager = _redis_mgr
    logger.info("Socket.IO Redis adapter enabled")


# ---------------------------------------------------------------------------
# Connection lifecycle
# ---------------------------------------------------------------------------

@sio.event
async def connect(sid: str, environ: dict, auth: dict) -> bool:
    """
    Called when a client connects.

    Authentication sources (checked in order):
    1. `auth["token"]` — standard Socket.IO client (browser, Node.js, Python)
    2. `?token=JWT` in query string — for Postman / raw WebSocket clients
    """
    token = _extract_token(auth, environ)
    if not token:
        logger.warning("Auth failed (no token) sid=%s", sid)
        return False

    user_info = _authenticate(token)
    if not user_info:
        logger.warning("Auth failed (invalid token) sid=%s", sid)
        return False

    user_id = user_info["user_id"]
    username = user_info["username"]
    email = user_info["email"]

    connected_at = datetime.now(UTC).isoformat()
    session_payload = {
        "user_id": user_id,
        "username": username,
        "email": email,
        "connected_at": connected_at,
    }

    # Store user info on the socket.io session for quick lookups within handlers
    await sio.save_session(sid, session_payload)

    # Determine default and previously remembered rooms to restore subscriptions
    default_rooms = {f"user:{user_id}", "notifications"}
    remembered_rooms = set(await realtime_state.list_user_rooms(user_id))
    rooms_to_join = sorted(default_rooms | remembered_rooms)

    for room in rooms_to_join:
        await sio.enter_room(sid, room)

    # Persist session/room state in Redis (or in-memory fallback)
    session_model = SessionData(
        sid=sid,
        user_id=user_id,
        username=username,
        email=email,
        connected_at=connected_at,
    )
    is_first_connection, _ = await realtime_state.register_session(session_model, rooms_to_join)

    # Broadcast presence to everyone who watches "user_updates" only when the user
    # becomes online (first active socket).
    if is_first_connection:
        await sio.emit("user_status", {
            "user_id": user_id,
            "status": "online",
            "username": username,
            "last_seen": connected_at,
        }, room="user_updates")

    logger.info("Socket.IO connect  sid=%s  user=%s", sid, user_id)

    # Emit confirmation to the connecting client only
    await sio.emit("authenticated", {
        "socket_id": sid,
        "user_id": user_id,
        "email": email,
        "username": username,
        "connected_at": connected_at,
    }, to=sid)

    return True


@sio.event
async def disconnect(sid: str) -> None:
    """Handle client disconnection and clean up presence."""
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None

    stored_session, remaining = await realtime_state.remove_session(sid)
    if not user_id and stored_session:
        user_id = stored_session.user_id

    if user_id and remaining == 0:
        await sio.emit("user_status", {
            "user_id": user_id,
            "status": "offline",
            "last_seen": datetime.now(UTC).isoformat(),
        }, room="user_updates")
        logger.info("Socket.IO disconnect  sid=%s  user=%s", sid, user_id)
    elif user_id:
        logger.info(
            "Socket.IO disconnect sid=%s user=%s (other sockets still online=%d)",
            sid,
            user_id,
            remaining,
        )
    else:
        logger.info("Socket.IO disconnect  sid=%s  (no session)", sid)


# ---------------------------------------------------------------------------
# Event handlers defined elsewhere – registered via core/websocket_events.py
# ---------------------------------------------------------------------------

def register_event_handler(event: str, handler: Callable) -> None:
    """Allow external modules to register event handlers on the global sio."""
    sio.on(event, handler)


# ---------------------------------------------------------------------------
# Public helpers (used by REST endpoints, Celery tasks, etc.)
# ---------------------------------------------------------------------------

async def emit_to_user(
    user_id: str,
    event: str,
    data: dict,
    namespace: str = "/",
) -> int:
    """
    Emit an event to all sockets belonging to a specific user.

    Returns the number of rooms the event was sent to (0 if user offline).
    """
    room = f"user:{user_id}"
    await sio.emit(event, data, room=room, namespace=namespace)
    # We can't easily count receivers here, so return 1 as best-effort
    return 1


async def emit_to_room(
    room: str,
    event: str,
    data: dict,
    namespace: str = "/",
    skip_sid: Optional[str] = None,
) -> None:
    """Emit an event to all sockets in a room."""
    await sio.emit(event, data, room=room, namespace=namespace, skip_sid=skip_sid)


async def emit_broadcast(
    event: str,
    data: dict,
    namespace: str = "/",
) -> None:
    """Broadcast an event to **all** connected clients."""
    await sio.emit(event, data, namespace=namespace)


async def send_notification(
    user_id: str,
    title: str,
    message: str,
    notification_type: str = "general",
    data: Optional[dict] = None,
) -> None:
    """Convenience method: emit a 'notification' event to a user."""
    await emit_to_user(user_id, "notification", {
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "created_at": datetime.utcnow().isoformat(),
    })


async def get_online_users() -> List[str]:
    """
    Return a list of unique user_ids that are currently connected.
    NOTE: This is a best-effort implementation.  In production with the
    Redis adapter you should use a dedicated presence store.
    """
    # sio.manager is an internal; we approximate through rooms.
    # "user:*" rooms hold each user's sockets, so we enumerate them.
    rooms = sio.manager.rooms  # This is a dict: {namespace: {room: {sid}}}
    namespace_map = rooms.get("/", {})
    user_ids = set()
    prefix = "user:"
    for room_id in namespace_map:
        if room_id.startswith(prefix):
            uid = room_id[len(prefix):]
            if uid:
                user_ids.add(uid)
    return list(user_ids)


def get_sio() -> AsyncServer:
    """Return the global Socket.IO server instance."""
    return sio