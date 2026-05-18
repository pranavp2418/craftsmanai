"""
Redis-backed Server-Sent Events (SSE) manager.

All ``publish()`` calls go through Redis pub/sub on channel ``sse:<channel>``,
which guarantees cross-process delivery (Celery workers, API servers, etc.)
The in-memory subscriber queues exist only on the consumer side (the FastAPI
process that owns the SSE endpoint).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional

import redis.asyncio as redis_asyncio

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers – same as before
# ---------------------------------------------------------------------------


def _encode_data(data: Any) -> str:
    if data is None:
        return "null"
    if isinstance(data, (str, bytes)):
        return data.decode("utf-8") if isinstance(data, bytes) else data
    try:
        return json.dumps(data, ensure_ascii=False)
    except (TypeError, ValueError):
        return str(data)


def _format_sse(
    *,
    data: str,
    event: Optional[str] = None,
    event_id: Optional[str] = None,
    retry: Optional[int] = None,
    comment: Optional[str] = None,
) -> str:
    lines: List[str] = []
    if comment:
        for line in comment.splitlines() or [comment]:
            lines.append(f": {line}")
    if event_id:
        lines.append(f"id: {event_id}")
    if event:
        lines.append(f"event: {event}")
    if retry is not None:
        lines.append(f"retry: {retry}")
    for line in data.splitlines() or [""]:
        lines.append(f"data: {line}")
    return "\n".join(lines) + "\n\n"


# ---------------------------------------------------------------------------
# Redis channel helpers
# ---------------------------------------------------------------------------

_REDIS_CHANNEL_PREFIX = "sse:"


def _redis_channel(channel: str) -> str:
    return f"{_REDIS_CHANNEL_PREFIX}{channel}"


# ---------------------------------------------------------------------------
# Synchronous Redis client (for publish calls from any process)
# ---------------------------------------------------------------------------

_sync_redis: Any = None


def _get_sync_redis() -> Any:
    """Return a lazily-created synchronous Redis client."""
    global _sync_redis
    if _sync_redis is None:
        import redis as _sync_redis_module

        _sync_redis = _sync_redis_module.from_url(
            settings.REDIS_URL, decode_responses=True
        )
    return _sync_redis


# ---------------------------------------------------------------------------
# Async Redis client (for the background listener)
# ---------------------------------------------------------------------------

_async_redis: Optional[redis_asyncio.Redis] = None


async def _get_async_redis() -> Optional[redis_asyncio.Redis]:
    global _async_redis
    if _async_redis is None:
        try:
            _async_redis = redis_asyncio.from_url(
                settings.REDIS_URL, decode_responses=True
            )
            await _async_redis.ping()
        except Exception as exc:
            logger.warning("Redis unavailable for SSE: %s", exc)
            _async_redis = None  # type: ignore[assignment]
    return _async_redis


# ---------------------------------------------------------------------------
# SSEManager
# ---------------------------------------------------------------------------


class SSEManager:
    """Pub/sub SSE manager backed by Redis for cross-process delivery.

    *Any* process (FastAPI, Celery worker, etc.) can call ``publish()`` – it
    always writes to a Redis pub/sub channel.

    Only the process that owns the SSE endpoint (FastAPI) runs the background
    ``_listener`` task that subscribes to ``sse:*`` Redis channels and forwards
    incoming events to the local in-memory subscriber queues.
    """

    def __init__(self) -> None:
        # Local subscriber queues: channel -> [Queue[str]]
        self._channels: Dict[str, List[asyncio.Queue[str]]] = {}
        self._lock = asyncio.Lock()

    # -- Public API ----------------------------------------------------------

    async def subscribe(self, channel: str) -> asyncio.Queue[str]:
        """Register a new subscriber for *channel* and return its queue."""
        queue: asyncio.Queue[str] = asyncio.Queue()
        async with self._lock:
            subscribers = self._channels.setdefault(channel, [])
            subscribers.append(queue)
            logger.info(
                "SSE subscriber added to '%s' – total: %d", channel, len(subscribers)
            )
        return queue

    async def unsubscribe(self, channel: str, queue: asyncio.Queue[str]) -> None:
        """Remove a subscriber queue from *channel*."""
        async with self._lock:
            subscribers = self._channels.get(channel)
            if not subscribers:
                return
            try:
                subscribers.remove(queue)
            except ValueError:
                return
            if not subscribers:
                self._channels.pop(channel, None)

    def publish(
        self,
        channel: str,
        *,
        data: Any,
        event: Optional[str] = None,
        event_id: Optional[str] = None,
        retry: Optional[int] = None,
        comment: Optional[str] = None,
    ) -> int:
        """Publish an event to *channel* via Redis pub/sub.

        This is a **synchronous** method so it works seamlessly from Celery
        tasks without ``asyncio.run()`` wrappers.

        Returns ``0`` – the local subscriber count is only meaningful in the
        process that owns the SSE endpoint.
        """
        payload = json.dumps(
            {
                "data": data,
                "event": event,
                "event_id": event_id,
                "retry": retry,
                "comment": comment,
            },
            ensure_ascii=False,
        )
        try:
            r = _get_sync_redis()
            r.publish(_redis_channel(channel), payload)
        except Exception as exc:
            logger.exception("Failed to publish SSE event to Redis: %s", exc)
        return 0

    async def listen(
        self,
        channel: str,
        *,
        heartbeat: Optional[float] = None,
    ) -> AsyncIterator[str]:
        """Yield events for *channel* as an async generator.

        The caller must be in the same process as the background Redis listener
        (typically the FastAPI process).
        """
        queue = await self.subscribe(channel)
        try:
            while True:
                if heartbeat and heartbeat > 0:
                    try:
                        message = await asyncio.wait_for(
                            queue.get(), timeout=heartbeat
                        )
                    except asyncio.TimeoutError:
                        yield ": keep-alive\n\n"
                        continue
                else:
                    message = await queue.get()
                yield message
        except asyncio.CancelledError:
            raise
        finally:
            await self.unsubscribe(channel, queue)

    # -- Background Redis listener -------------------------------------------

    async def start_listener(self) -> None:
        """Subscribe to all ``sse:*`` Redis channels and forward events to
        local subscriber queues.

        Intended to be started once as a background asyncio task during FastAPI
        startup (via the ``lifespan`` context manager).
        """
        redis_client = await _get_async_redis()
        if redis_client is None:
            logger.warning(
                "SSE Redis listener not started – cross-process events "
                "will NOT be delivered to SSE clients."
            )
            return

        pubsub = redis_client.pubsub()
        await pubsub.psubscribe(f"{_REDIS_CHANNEL_PREFIX}*")

        logger.info("SSE Redis listener started on sse:* channels")

        try:
            async for message in pubsub.listen():
                await self._on_redis_message(message)
        except asyncio.CancelledError:
            logger.info("SSE Redis listener cancelled.")
            raise
        except Exception as exc:
            logger.exception("SSE Redis listener error: %s", exc)
        finally:
            await pubsub.punsubscribe(f"{_REDIS_CHANNEL_PREFIX}*")
            await pubsub.close()

    async def _on_redis_message(self, message: dict[str, Any]) -> None:
        """Deserialise a Redis pub/sub message and push it to local queues.

        When using ``psubscribe`` (pattern-based subscription), Redis delivers
        messages with ``type`` = ``"pmessage"``, while exact ``subscribe``
        delivers with ``type`` = ``"message"``.  We accept both.
        """
        msg_type: str = message.get("type", "")
        if msg_type not in ("message", "pmessage"):
            return

        # For ``pmessage`` the actual channel is in ``channel`` (same key);
        # for ``message`` it is also in ``channel``.
        channel: str = message.get("channel", "")
        payload_raw: str = message.get("data", "")

        if not channel.startswith(_REDIS_CHANNEL_PREFIX):
            return
        actual_channel = channel[len(_REDIS_CHANNEL_PREFIX) :]

        try:
            payload = json.loads(payload_raw)
        except (TypeError, ValueError):
            logger.warning("Ignoring unparseable SSE payload on %s", channel)
            return

        sse_message = _format_sse(
            data=_encode_data(payload.get("data")),
            event=payload.get("event"),
            event_id=payload.get("event_id"),
            retry=payload.get("retry"),
            comment=payload.get("comment"),
        )

        async with self._lock:
            queues = list(self._channels.get(actual_channel, []))

        logger.info(
            "SSE Redis listener received event for channel='%s', forwarding to %d local subscriber(s)",
            actual_channel, len(queues),
        )

        for q in queues:
            q.put_nowait(sse_message)


sse_manager = SSEManager()

__all__ = ["SSEManager", "sse_manager"]