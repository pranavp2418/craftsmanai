from fastapi import APIRouter

from .create_manufacturer import router as create_router
from .update_manufacturer import router as update_router
from .get_manufacturer import router as get_router
from .list_manufacturers import router as list_router

router = APIRouter(prefix="/manufacturer", tags=["manufacturer"])

router.include_router(create_router)
router.include_router(update_router)
router.include_router(get_router)
router.include_router(list_router)
