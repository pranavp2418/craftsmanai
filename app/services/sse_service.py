"""High-level helpers for publishing Server-Sent Events (SSE)."""

from typing import Any, Optional

from app.core.sse_manager import sse_manager


class SSEService:
    """Facade around :mod:`app.core.sse_manager` for reuse across the app."""

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
        """Push an event onto ``channel`` and return subscriber count."""

        return await sse_manager.publish(
            channel,
            data=data,
            event=event,
            event_id=event_id,
            retry=retry,
            comment=comment,
        )


sse_service = SSEService()

__all__ = ["sse_service", "SSEService"]
