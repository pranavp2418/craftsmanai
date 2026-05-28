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
from .core.sse_manager import sse_manager

# ---------------------------------------------------------------------------
# Configure logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(settings.LOG_FILE),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Define allowed CORS origins
# IMPORTANT:
# - Do NOT use "*" when allow_credentials=True
# - Add every frontend URL you use
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    
    # Local network frontend
    "http://192.168.1.83:3000",

    # Dev tunnels (update when changed)
    "https://k6r4l6c7-3000.inc1.devtunnels.ms",
    "https://gq7l179z-3000.inc1.devtunnels.ms",
    "https://2vrmpjhw-3000.inc1.devtunnels.ms",
]

# ---------------------------------------------------------------------------
# Socket.IO Server
# IMPORTANT:
# Socket.IO requires its OWN CORS configuration
# FastAPI middleware does NOT apply to /socket.io
# ---------------------------------------------------------------------------
sio = socketio.AsyncServer(
    async_mode="asgi",

    cors_allowed_origins=ALLOWED_ORIGINS,

    # Recommended settings
    allow_upgrades=True,
    logger=True,
    engineio_logger=True,

    # Optional
    ping_timeout=60,
    ping_interval=25,
)

# ---------------------------------------------------------------------------
# Import WebSocket event handlers AFTER sio is created
# ---------------------------------------------------------------------------
from .core import websocket_events  # noqa: F401

# ---------------------------------------------------------------------------
# Lifespan events
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Craftmen Backend starting up...")

    # Start SSE Redis listener
    sse_listener_task = asyncio.create_task(
        sse_manager.start_listener()
    )

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

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
fastapi_app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Craftmen application",
    version="2.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS Middleware for REST APIs
# ---------------------------------------------------------------------------
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Middleware Order
# ---------------------------------------------------------------------------
fastapi_app.add_middleware(HealthCheckMiddleware)
fastapi_app.add_middleware(RequestLoggingMiddleware)
fastapi_app.add_middleware(SecurityHeadersMiddleware)

# NOTE:
# If websocket issues continue,
# temporarily comment these out for testing
fastapi_app.add_middleware(IPBasedRateLimitMiddleware)
fastapi_app.add_middleware(GlobalRateLimitMiddleware)

# ---------------------------------------------------------------------------
# Register API Routes
# ---------------------------------------------------------------------------
fastapi_app.include_router(api_router, prefix="/api/v2")

# ---------------------------------------------------------------------------
# Socket.IO ASGI Wrapper
# ---------------------------------------------------------------------------
app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=fastapi_app,
    socketio_path="socket.io",
)

# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------
__all__ = ["fastapi_app", "app", "sio"]