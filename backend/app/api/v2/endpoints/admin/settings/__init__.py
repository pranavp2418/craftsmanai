from fastapi import APIRouter
from . import update_settings

router = APIRouter()

router.include_router(update_settings.router, tags=["admin-settings"])
