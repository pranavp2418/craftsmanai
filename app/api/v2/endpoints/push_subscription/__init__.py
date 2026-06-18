from fastapi import APIRouter

from .register import router as register_router

router = APIRouter(prefix="/push-subscriptions", tags=["push-subscriptions"])

router.include_router(register_router)