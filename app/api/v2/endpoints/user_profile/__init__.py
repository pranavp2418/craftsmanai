from fastapi import APIRouter

from .get_user_profile import router as get_router
from .update_user_profile import router as update_router
from .change_password import router as change_password_router
from .toggle_2fa import router as toggle_2fa_router
from .active_sessions import router as active_sessions_router
from .appearance import router as appearance_router

router = APIRouter(prefix="/user-profile", tags=["user_profile"])

router.include_router(get_router)
router.include_router(update_router)
router.include_router(change_password_router)
router.include_router(toggle_2fa_router)
router.include_router(active_sessions_router)
router.include_router(appearance_router)
