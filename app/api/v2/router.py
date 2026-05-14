from fastapi import APIRouter
from .endpoints.router import api_router as endpoints_router
from .endpoints.sse import router as sse_router

api_router = APIRouter()

# Register endpoint routers
api_router.include_router(endpoints_router, tags=["endpoints"])
api_router.include_router(sse_router, prefix="/endpoints", tags=["sse"])
