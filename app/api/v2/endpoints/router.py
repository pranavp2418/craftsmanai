from fastapi import APIRouter

# Import individual route modules here as they are created
from .auth import router as auth_router
from .health import router as health_router
from .websocket import router as websocket_router
from .sse import router as sse_router

api_router = APIRouter()

# Register routers here
api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])
api_router.include_router(health_router, prefix="/endpoints", tags=["health"])
api_router.include_router(websocket_router, prefix="/endpoints", tags=["websocket"])
api_router.include_router(sse_router, prefix="/endpoints", tags=["sse"])
