"""High-level helpers for publishing Server-Sent Events (SSE).

All publish calls go through Redis pub/sub via ``sse_manager.publish()``,
which works seamlessly from *any* process (Celery worker, FastAPI, etc.).
"""

from typing import Any, Optional

from app.core.sse_manager import sse_manager


class SSEService:
    """Facade around :mod:`app.core.sse_manager` for reuse across the app."""

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
        """Push an event onto ``channel`` via Redis pub/sub.

        This is a **synchronous** method – it works from Celery tasks,
        background threads, and async request handlers alike.
        """
        return sse_manager.publish(
            channel,
            data=data,
            event=event,
            event_id=event_id,
            retry=retry,
            comment=comment,
        )

    def publish_close(
        self,
        channel: str,
        *,
        event: Optional[str] = None,
    ) -> int:
        """Publish a close signal to *channel*.

        Subscribers currently listening on this channel will stop streaming
        after receiving this signal (the connection is closed gracefully).
        """
        return sse_manager.publish_close(channel, event=event)


sse_service = SSEService()

__all__ = ["sse_service", "SSEService"]
