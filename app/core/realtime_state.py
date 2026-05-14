"""Redis-backed real-time session & room state management.

Provides a thin asynchronous abstraction used by the Socket.IO layer to keep
track of connected sessions, map users to their active socket IDs, and persist
room memberships so reconnecting clients can be restored automatically.

When Redis is unavailable (e.g. locally without Redis running or in tests), the
manager transparently falls back to an in-memory store so the rest of the
application continues to operate.  The in-memory backend mirrors the Redis API
but obviously does not provide cross-process durability.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Set, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

try:  # pragma: no cover - import path differs when redis is mocked
    from redis import asyncio as redis_asyncio
except Exception:  # pragma: no cover - fallback when redis isn't installed
    redis_asyncio = None  # type: ignore


SESSION_TTL_SECONDS = 60 * 60 * 24  # 24 hours for session/room persistence


@dataclass
class SessionData:
    """Structured representation of a socket session."""

    sid: str
    user_id: str
    username: str
    email: str
    connected_at: str

    @classmethod
    def from_dict(cls, sid: str, payload: Dict[str, str]) -> Optional["SessionData"]:
        if not payload:
            return None
        user_id = payload.get("user_id")
        username = payload.get("username", "")
        email = payload.get("email", "")
        connected_at = payload.get("connected_at", "")
        if not user_id:
            return None
        return cls(sid=sid, user_id=user_id, username=username, email=email, connected_at=connected_at)


class BaseRealtimeState:
    """Abstract interface shared by Redis and in-memory implementations."""

    async def register_session(
        self,
        session: SessionData,
        rooms: Iterable[str],
    ) -> Tuple[bool, SessionData]:
        """Persist session information.

        Returns a tuple ``(is_first_connection, session)`` where
        ``is_first_connection`` indicates whether this is the first active socket
        for the user (used to avoid duplicate "online" presence broadcasts).
        """

    async def remove_session(self, sid: str) -> Tuple[Optional[SessionData], int]:
        """Remove session and return (session, remaining_socket_count)."""

    async def get_session(self, sid: str) -> Optional[SessionData]:
        """Fetch session data for a socket ID."""

    async def list_user_rooms(self, user_id: str) -> List[str]:
        """Return known room memberships for a user."""

    async def add_rooms(self, user_id: str, rooms: Iterable[str]) -> None:
        """Persist room memberships for a user."""

    async def remove_rooms(self, user_id: str, rooms: Iterable[str]) -> None:
        """Remove room memberships for a user."""

    async def list_user_sockets(self, user_id: str) -> List[str]:
        """Return active socket IDs for a user."""


class InMemoryRealtimeState(BaseRealtimeState):
    """Fallback backend used when Redis is unavailable."""

    def __init__(self) -> None:
        self._sessions: Dict[str, SessionData] = {}
        self._user_sockets: Dict[str, Set[str]] = {}
        self._user_rooms: Dict[str, Set[str]] = {}
        self._lock = asyncio.Lock()

    async def register_session(
        self,
        session: SessionData,
        rooms: Iterable[str],
    ) -> Tuple[bool, SessionData]:
        async with self._lock:
            self._sessions[session.sid] = session
            sockets = self._user_sockets.setdefault(session.user_id, set())
            sockets.add(session.sid)
            room_set = self._user_rooms.setdefault(session.user_id, set())
            room_set.update(rooms)
            is_first = len(sockets) == 1
            return is_first, session

    async def remove_session(self, sid: str) -> Tuple[Optional[SessionData], int]:
        async with self._lock:
            session = self._sessions.pop(sid, None)
            remaining = 0
            if session:
                sockets = self._user_sockets.get(session.user_id, set())
                sockets.discard(sid)
                remaining = len(sockets)
                if remaining == 0:
                    self._user_sockets.pop(session.user_id, None)
            return session, remaining

    async def get_session(self, sid: str) -> Optional[SessionData]:
        async with self._lock:
            return self._sessions.get(sid)

    async def list_user_rooms(self, user_id: str) -> List[str]:
        async with self._lock:
            return list(self._user_rooms.get(user_id, set()))

    async def add_rooms(self, user_id: str, rooms: Iterable[str]) -> None:
        async with self._lock:
            room_set = self._user_rooms.setdefault(user_id, set())
            room_set.update(rooms)

    async def remove_rooms(self, user_id: str, rooms: Iterable[str]) -> None:
        async with self._lock:
            room_set = self._user_rooms.get(user_id)
            if not room_set:
                return
            room_set.difference_update(rooms)
            if not room_set:
                self._user_rooms.pop(user_id, None)

    async def list_user_sockets(self, user_id: str) -> List[str]:
        async with self._lock:
            return list(self._user_sockets.get(user_id, set()))


class RedisRealtimeState(BaseRealtimeState):
    """Redis implementation of the real-time state store."""

    def __init__(self, redis_client: "redis_asyncio.Redis") -> None:  # type: ignore[name-defined]
        self._redis = redis_client

    @staticmethod
    def _session_key(sid: str) -> str:
        return f"realtime:sessions:{sid}"

    @staticmethod
    def _user_sockets_key(user_id: str) -> str:
        return f"realtime:user:{user_id}:sockets"

    @staticmethod
    def _user_rooms_key(user_id: str) -> str:
        return f"realtime:user:{user_id}:rooms"

    async def _touch_key(self, key: str) -> None:
        try:
            await self._redis.expire(key, SESSION_TTL_SECONDS)
        except Exception:
            logger.exception("Failed to set TTL for key %s", key)

    async def register_session(
        self,
        session: SessionData,
        rooms: Iterable[str],
    ) -> Tuple[bool, SessionData]:
        session_key = self._session_key(session.sid)
        sockets_key = self._user_sockets_key(session.user_id)
        rooms_key = self._user_rooms_key(session.user_id)

        try:
            await self._redis.hset(
                session_key,
                mapping={
                    "user_id": session.user_id,
                    "username": session.username,
                    "email": session.email,
                    "connected_at": session.connected_at,
                },
            )
            await self._touch_key(session_key)

            await self._redis.sadd(sockets_key, session.sid)
            await self._touch_key(sockets_key)

            room_list = list(rooms)
            if room_list:
                await self._redis.sadd(rooms_key, *room_list)
                await self._touch_key(rooms_key)

            socket_count = await self._redis.scard(sockets_key)
            is_first = socket_count == 1
            return is_first, session
        except Exception as exc:  # pragma: no cover - network failure path
            logger.warning("Redis unavailable for realtime register_session: %s", exc)
            raise

    async def remove_session(self, sid: str) -> Tuple[Optional[SessionData], int]:
        session_key = self._session_key(sid)
        try:
            payload = await self._redis.hgetall(session_key)
            session = SessionData.from_dict(sid, payload)
            await self._redis.delete(session_key)
            if not session:
                return None, 0

            sockets_key = self._user_sockets_key(session.user_id)
            await self._redis.srem(sockets_key, sid)
            remaining = await self._redis.scard(sockets_key)
            if remaining == 0:
                await self._touch_key(self._user_rooms_key(session.user_id))
            else:
                await self._touch_key(sockets_key)
            return session, remaining
        except Exception as exc:  # pragma: no cover
            logger.warning("Redis unavailable for realtime remove_session: %s", exc)
            raise

    async def get_session(self, sid: str) -> Optional[SessionData]:
        session_key = self._session_key(sid)
        try:
            payload = await self._redis.hgetall(session_key)
            if payload:
                await self._touch_key(session_key)
            return SessionData.from_dict(sid, payload)
        except Exception as exc:  # pragma: no cover
            logger.warning("Redis unavailable for realtime get_session: %s", exc)
            raise

    async def list_user_rooms(self, user_id: str) -> List[str]:
        key = self._user_rooms_key(user_id)
        try:
            rooms = await self._redis.smembers(key)
            if rooms:
                await self._touch_key(key)
            return sorted(rooms)
        except Exception as exc:  # pragma: no cover
            logger.warning("Redis unavailable for realtime list_user_rooms: %s", exc)
            raise

    async def add_rooms(self, user_id: str, rooms: Iterable[str]) -> None:
        room_list = [room for room in rooms if room]
        if not room_list:
            return
        key = self._user_rooms_key(user_id)
        try:
            await self._redis.sadd(key, *room_list)
            await self._touch_key(key)
        except Exception as exc:  # pragma: no cover
            logger.warning("Redis unavailable for realtime add_rooms: %s", exc)
            raise

    async def remove_rooms(self, user_id: str, rooms: Iterable[str]) -> None:
        room_list = [room for room in rooms if room]
        if not room_list:
            return
        key = self._user_rooms_key(user_id)
        try:
            await self._redis.srem(key, *room_list)
            await self._touch_key(key)
        except Exception as exc:  # pragma: no cover
            logger.warning("Redis unavailable for realtime remove_rooms: %s", exc)
            raise

    async def list_user_sockets(self, user_id: str) -> List[str]:
        key = self._user_sockets_key(user_id)
        try:
            sockets = await self._redis.smembers(key)
            if sockets:
                await self._touch_key(key)
            return sorted(sockets)
        except Exception as exc:  # pragma: no cover
            logger.warning("Redis unavailable for realtime list_user_sockets: %s", exc)
            raise


class RealtimeStateManager(BaseRealtimeState):
    """Facade that uses Redis when available and falls back to in-memory."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._backend: BaseRealtimeState = self._build_backend()

    @staticmethod
    def _build_backend() -> BaseRealtimeState:
        if redis_asyncio is None:
            logger.info("redis.asyncio not available – using in-memory realtime state")
            return InMemoryRealtimeState()

        try:
            client = redis_asyncio.Redis.from_url(  # type: ignore[attr-defined]
                settings.REDIS_URL,
                decode_responses=True,
            )
            logger.info("Realtime state backed by Redis at %s", settings.REDIS_URL)
            return RedisRealtimeState(client)
        except Exception as exc:  # pragma: no cover
            logger.warning("Failed to initialise Redis realtime state – falling back: %s", exc)
            return InMemoryRealtimeState()

    async def _ensure_backend(self) -> None:
        if isinstance(self._backend, RedisRealtimeState):
            return
        # Attempt to upgrade to Redis if possible (only once per process)
        async with self._lock:
            if isinstance(self._backend, RedisRealtimeState):
                return
            self._backend = self._build_backend()

    async def register_session(
        self,
        session: SessionData,
        rooms: Iterable[str],
    ) -> Tuple[bool, SessionData]:
        try:
            await self._ensure_backend()
            return await self._backend.register_session(session, rooms)
        except Exception:
            # Downgrade to in-memory and retry once
            logger.exception("Realtime register_session failed; switching to in-memory store")
            async with self._lock:
                self._backend = InMemoryRealtimeState()
            return await self._backend.register_session(session, rooms)

    async def remove_session(self, sid: str) -> Tuple[Optional[SessionData], int]:
        try:
            await self._ensure_backend()
            return await self._backend.remove_session(sid)
        except Exception:
            logger.exception("Realtime remove_session failed; switching to in-memory store")
            async with self._lock:
                self._backend = InMemoryRealtimeState()
            return await self._backend.remove_session(sid)

    async def get_session(self, sid: str) -> Optional[SessionData]:
        try:
            await self._ensure_backend()
            return await self._backend.get_session(sid)
        except Exception:
            logger.exception("Realtime get_session failed; switching to in-memory store")
            async with self._lock:
                self._backend = InMemoryRealtimeState()
            return await self._backend.get_session(sid)

    async def list_user_rooms(self, user_id: str) -> List[str]:
        try:
            await self._ensure_backend()
            return await self._backend.list_user_rooms(user_id)
        except Exception:
            logger.exception("Realtime list_user_rooms failed; switching to in-memory store")
            async with self._lock:
                self._backend = InMemoryRealtimeState()
            return await self._backend.list_user_rooms(user_id)

    async def add_rooms(self, user_id: str, rooms: Iterable[str]) -> None:
        try:
            await self._ensure_backend()
            await self._backend.add_rooms(user_id, rooms)
        except Exception:
            logger.exception("Realtime add_rooms failed; switching to in-memory store")
            async with self._lock:
                self._backend = InMemoryRealtimeState()
            await self._backend.add_rooms(user_id, rooms)

    async def remove_rooms(self, user_id: str, rooms: Iterable[str]) -> None:
        try:
            await self._ensure_backend()
            await self._backend.remove_rooms(user_id, rooms)
        except Exception:
            logger.exception("Realtime remove_rooms failed; switching to in-memory store")
            async with self._lock:
                self._backend = InMemoryRealtimeState()
            await self._backend.remove_rooms(user_id, rooms)

    async def list_user_sockets(self, user_id: str) -> List[str]:
        try:
            await self._ensure_backend()
            return await self._backend.list_user_sockets(user_id)
        except Exception:
            logger.exception("Realtime list_user_sockets failed; switching to in-memory store")
            async with self._lock:
                self._backend = InMemoryRealtimeState()
            return await self._backend.list_user_sockets(user_id)


realtime_state = RealtimeStateManager()

__all__ = ["realtime_state", "SessionData", "RealtimeStateManager"]