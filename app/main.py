from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from .api.v2.router import api_router
from .core.config import settings
from .core.middleware import (
    GlobalRateLimitMiddleware,
    IPBasedRateLimitMiddleware,
    SecurityHeadersMiddleware,
    RequestLoggingMiddleware,
    HealthCheckMiddleware
)

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(settings.LOG_FILE),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Craftmen Backend starting up...")
    yield
    # Shutdown
    logger.info("Craftmen Backend shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Craftmen application",
    version="2.0.0",
    lifespan=lifespan
)

# Add middleware in correct order
app.add_middleware(HealthCheckMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(IPBasedRateLimitMiddleware)
app.add_middleware(GlobalRateLimitMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v2")
