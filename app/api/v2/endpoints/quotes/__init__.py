from fastapi import APIRouter

from .submit_quote import router as submit_router
from .approve_quote import router as approve_router
from .reject_quote import router as reject_router
from .list_quotes import router as list_router

router = APIRouter(prefix="/quotes", tags=["quotes"])

router.include_router(submit_router)
router.include_router(approve_router)
router.include_router(reject_router)
router.include_router(list_router)
