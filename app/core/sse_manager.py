"""Server-Sent Events (SSE) manager.

This module provides a lightweight publish/subscribe mechanism that allows
async producers (Celery tasks, background jobs, request handlers, etc.) to
push updates to connected SSE clients.  It mirrors the role played by
``socket_manager`` for Socket.IO but keeps the implementation dependency free
by relying solely on asyncio primitives.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, AsyncIterator, Dict, List, Optional


def _encode_data(data: Any) -> str:
    """Serialise payloads destined for the SSE ``data`` field."""

    if data is None:
        return "null"
    if isinstance(data, (str, bytes)):
        return data.decode("utf-8") if isinstance(data, bytes) else data
    try:
        return json.dumps(data, ensure_ascii=False)
    except (TypeError, ValueError):  # Fallback to str() if not JSON serialisable
        return str(data)


def _format_sse(
    *,
    data: str,
    event: Optional[str] = None,
    event_id: Optional[str] = None,
    retry: Optional[int] = None,
    comment: Optional[str] = None,
) -> str:
    """Format a message according to the SSE protocol."""

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

    # Each line in the payload must be prefixed with ``data: ``
    for line in data.splitlines() or [""]:
        lines.append(f"data: {line}")

    return "\n".join(lines) + "\n\n"


class SSEManager:
    """Keep track of SSE subscribers and dispatch events to them."""

    def __init__(self) -> None:
        self._channels: Dict[str, List[asyncio.Queue[str]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, channel: str) -> asyncio.Queue[str]:
        """Register a new subscriber for a channel and return its queue."""

        queue: asyncio.Queue[str] = asyncio.Queue()
        async with self._lock:
            subscribers = self._channels.setdefault(channel, [])
            subscribers.append(queue)
        return queue

    async def unsubscribe(self, channel: str, queue: asyncio.Queue[str]) -> None:
        """Remove a subscriber queue from the channel."""

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

    async def publish(
        self,
        channel: str,
        *,
        data: Any,
        event: Optional[str] = None,
        event_id: Optional[str] = None,
        retry: Optional[int] = None,
        comment: Optional[str] = None,
    ) -> int:
        """Broadcast an event to all current subscribers of ``channel``.

        Returns the number of subscribers that the event was queued for.
        """

        message = _format_sse(
            data=_encode_data(data),
            event=event,
            event_id=event_id,
            retry=retry,
            comment=comment,
        )

        async with self._lock:
            subscribers = list(self._channels.get(channel, []))

        for queue in subscribers:
            # ``put_nowait`` keeps publication non-blocking; the queue is
            # unbounded so this will not raise ``QueueFull``.
            queue.put_nowait(message)

        return len(subscribers)

    async def listen(
        self,
        channel: str,
        *,
        heartbeat: Optional[float] = None,
    ) -> AsyncIterator[str]:
        """Yield events for a channel as an async generator.

        ``heartbeat`` can be used to periodically emit SSE comments so that
        idle connections remain open through proxies that enforce timeouts.
        """

        queue = await self.subscribe(channel)

        try:
            while True:
                if heartbeat and heartbeat > 0:
                    try:
                        message = await asyncio.wait_for(queue.get(), timeout=heartbeat)
                    except asyncio.TimeoutError:
                        # SSE comments (lines that start with ``:``) act as keep-alive pings.
                        yield ": keep-alive\n\n"
                        continue
                else:
                    message = await queue.get()

                yield message
        except asyncio.CancelledError:
            raise
        finally:
            await self.unsubscribe(channel, queue)


sse_manager = SSEManager()

__all__ = ["SSEManager", "sse_manager"]
