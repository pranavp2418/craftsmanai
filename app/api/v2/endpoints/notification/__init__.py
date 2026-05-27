"""
Notification endpoints for listing and managing user notifications.
"""

from fastapi import APIRouter

from .list_notifications import router as list_router

router = APIRouter(prefix="/notifications", tags=["notifications"])

router.include_router(list_router)