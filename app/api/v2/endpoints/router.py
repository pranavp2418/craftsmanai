from fastapi import APIRouter

# Import individual route modules here as they are created
from .auth import router as auth_router
from .health import router as health_router
from .websocket import router as websocket_router
from .sse import router as sse_router
from .design import router as design_router
from .design_variant import router as design_variant_router
from .customer import router as customer_router
from .manufacturer import router as manufacturer_router
from .order import router as order_router
from .quotes import router as quotes_router
from .public import router as public_router

api_router = APIRouter()

# Register routers here
api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])
api_router.include_router(health_router, prefix="/endpoints", tags=["health"])
api_router.include_router(websocket_router, prefix="/endpoints", tags=["websocket"])
api_router.include_router(sse_router, prefix="/endpoints", tags=["sse"])
api_router.include_router(design_router)
api_router.include_router(design_variant_router)
api_router.include_router(customer_router)
api_router.include_router(manufacturer_router)
api_router.include_router(order_router)
api_router.include_router(quotes_router)
api_router.include_router(public_router)
