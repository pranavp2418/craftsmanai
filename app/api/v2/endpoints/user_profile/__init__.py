from fastapi import APIRouter

from .get_user_profile import router as get_router
from .update_user_profile import router as update_router

router = APIRouter(prefix="/user-profile", tags=["user_profile"])

router.include_router(get_router)
router.include_router(update_router)
