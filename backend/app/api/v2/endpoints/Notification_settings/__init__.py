from fastapi import APIRouter

from .get_notifications import router as get_router
from .update_notifications import router as update_router

router = APIRouter(prefix="/notification-settings", tags=["notification-settings"])

router.include_router(get_router)
router.include_router(update_router)
