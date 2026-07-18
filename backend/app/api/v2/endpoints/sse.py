"""REST endpoints for Server-Sent Events (SSE)."""

from __future__ import annotations

from typing import AsyncIterable

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.sse_manager import sse_manager
from app.core.dependencies import get_current_verified_user
from app.models.user import User
from app.schemas.sse import PublishEventRequest, PublishEventResult, SSEStreamMeta
from app.services.sse_service import sse_service


router = APIRouter()


@router.get("/sse/stream/{channel}", response_model=SSEStreamMeta, response_model_exclude_none=True)
async def stream_sse(
    channel: str,
    current_user: User = Depends(get_current_verified_user),
):
    """Open an SSE stream for ``channel`` and return handshake metadata."""

    heartbeat_interval = settings.SSE_HEARTBEAT_INTERVAL

    async def event_generator() -> AsyncIterable[str]:
        async for message in sse_manager.listen(channel, heartbeat=heartbeat_interval):
            yield message

    response = StreamingResponse(event_generator(), media_type="text/event-stream")
    response.headers.update(
        {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable proxy buffering (Nginx)
        }
    )

    # The response body will be streamed; we still return metadata here so that
    # the caller (e.g. tests) immediately knows the stream parameters.
    response.background = None  # Make explicit for clarity

    meta = SSEStreamMeta(channel=channel, heartbeat_interval=heartbeat_interval)
    response.headers["X-SSE-Channel"] = meta.channel
    response.headers["X-SSE-Heartbeat"] = str(meta.heartbeat_interval)

    return response


@router.post("/sse/publish", response_model=PublishEventResult)
async def publish_sse_event(
    payload: PublishEventRequest,
    current_user: User = Depends(get_current_verified_user),
):
    """Publish an SSE event to subscribed clients."""

    # publish() is now fully synchronous – no await needed.
    # It always goes through Redis pub/sub, so it works from
    # any process (Celery worker, FastAPI, etc.)
    delivered = sse_service.publish(
        payload.channel,
        data=payload.data,
        event=payload.event,
        event_id=payload.event_id,
        retry=payload.retry,
        comment=payload.comment,
    )

    return PublishEventResult(success=True, delivered_to=delivered)
