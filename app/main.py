import asyncio
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import socketio

from .api.v2.router import api_router
from .core.config import settings
from .core.middleware import (
    GlobalRateLimitMiddleware,
    IPBasedRateLimitMiddleware,
    SecurityHeadersMiddleware,
    RequestLoggingMiddleware,
    HealthCheckMiddleware,
)
from .core.socket_manager import sio
from .core.sse_manager import sse_manager

# ---------------------------------------------------------------------------
# Import WebSocket event handlers so the @sio.event decorators register them
# ---------------------------------------------------------------------------
from .core import websocket_events  # noqa: F401

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(settings.LOG_FILE),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Craftmen Backend starting up...")

    # Start the Redis SSE background listener – it subscribes to all ``sse:*``
    # Redis channels and forwards events to local subscriber queues so they
    # reach connected SSE clients.  This works whether the event was published
    # from the FastAPI process itself or from a Celery worker.
    sse_listener_task = asyncio.create_task(sse_manager.start_listener())
    logger.info("SSE Redis listener started.")

    yield

    # Shutdown
    logger.info("Craftmen Backend shutting down...")
    sse_listener_task.cancel()
    try:
        await sse_listener_task
    except asyncio.CancelledError:
        logger.info("SSE Redis listener cancelled.")
    logger.info("SSE Redis listener stopped.")


# ------------------------------------------------------------------
# Build the inner FastAPI application (REST routes)
# ------------------------------------------------------------------
fastapi_app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Craftmen application",
    version="2.0.0",
    lifespan=lifespan,
)

# Add middleware in correct order
fastapi_app.add_middleware(HealthCheckMiddleware)
fastapi_app.add_middleware(RequestLoggingMiddleware)
fastapi_app.add_middleware(SecurityHeadersMiddleware)
fastapi_app.add_middleware(IPBasedRateLimitMiddleware)
fastapi_app.add_middleware(GlobalRateLimitMiddleware)

# CORS middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    # allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_origins=["http://192.168.1.83:3000","https://k6r4l6c7-3000.inc1.devtunnels.ms","http://localhost:3000","https://gq7l179z-3000.inc1.devtunnels.ms","https://pq3ck368-8000.inc1.devtunnels.ms","https://2vrmpjhw-3000.inc1.devtunnels.ms","https://craftmenai.txogavideo.in"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST API routes
fastapi_app.include_router(api_router, prefix="/api/v2")

# ------------------------------------------------------------------
# Wrap everything: Socket.IO as outer app, FastAPI as fallback
# This ensures Socket.IO handles /socket.io/ directly without going
# through FastAPI's middleware chain (which breaks WebSocket protocol).
# ------------------------------------------------------------------
app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=fastapi_app,
    socketio_path="socket.io",
)

# Export both for different use cases:
# - fastapi_app: For REST API routes, dependency injection, tests
# - app: For ASGI server startup (includes Socket.IO wrapper)
__all__ = ["fastapi_app", "app"]
