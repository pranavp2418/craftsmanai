from fastapi import APIRouter

from .get_brand_settings import router as get_router
from .update_brand_settings import router as update_router

router = APIRouter(prefix="/brand-settings", tags=["brand-settings"])

router.include_router(get_router)
router.include_router(update_router)
