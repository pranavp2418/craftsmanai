from fastapi import APIRouter
from .request_overtime import router as overtime_request_router
from .request_status import router as request_status_router

router = APIRouter()

# Include customers routes
router.include_router(overtime_request_router)
router.include_router(request_status_router)