from fastapi import APIRouter
from .dashboard_stats import router as dashboard_stats_router
from .recent_sys_activities import router as recent_sys_activity_router
from .request_status import router as request_detail_router

router = APIRouter()

# Include dashboard routes
router.include_router(dashboard_stats_router, prefix="/stats")
router.include_router(recent_sys_activity_router, prefix="/admin_sys_activity")
router.include_router(request_detail_router, prefix="/request_status")
