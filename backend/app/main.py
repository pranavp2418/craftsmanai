import asyncio
from contextlib import asynccontextmanager
import logging
from pillow_heif import register_heif_opener

register_heif_opener()

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import socketio

from .api.v2.router import api_router
from .core.config import settings
from .core.middleware import (
    HybridRateLimitMiddleware,
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

# Ensure a fresh checkout can start before the log directory exists.
Path(settings.LOG_FILE).parent.mkdir(parents=True, exist_ok=True)

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
fastapi_app.add_middleware(HybridRateLimitMiddleware)

# CORS middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    # allow_origins=["http://192.168.1.83:3000","http://192.168.1.90:3000","http://192.168.1.79:8000","https://k6r4l6c7-3000.inc1.devtunnels.ms","https://z296mjqz-3000.inc1.devtunnels.ms/","https://nr201rgm-8000.inc1.devtunnels.ms","https://b38f2wvf-3000.inc1.devtunnels.ms","http://localhost:3000","https://gq7l179z-3000.inc1.devtunnels.ms","https://pq3ck368-8000.inc1.devtunnels.ms","https://2vrmpjhw-3000.inc1.devtunnels.ms"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST API routes
fastapi_app.include_router(api_router, prefix="/api/v2")

# Serve static filer push notification test page)
_static_dir = Path(__file__).parent / "static"
if _static_dir.exists():
    fastapi_app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")

# Serve the local-storage fallback (uploads/) over HTTP so images saved when a Supabase upload
# fails (e.g. 402) are still reachable BY URL — both for the frontend <img> display and for the
# backend's own re-download in angles/refine (requests.get needs a scheme; a bare filesystem
# path broke both). storage_service._save_to_local_storage returns {BACKEND_URL}/uploads/<path>.
_uploads_dir = Path("uploads")
_uploads_dir.mkdir(exist_ok=True)
fastapi_app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")

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
