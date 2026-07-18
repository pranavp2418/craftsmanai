from fastapi import APIRouter

from .create_order import router as create_router
from .update_order_status import router as update_router
from .get_order import router as get_router
from .list_orders import router as list_router

router = APIRouter(prefix="/order", tags=["order"])

router.include_router(create_router)
router.include_router(update_router)
router.include_router(get_router)
router.include_router(list_router)
