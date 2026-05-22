from fastapi import APIRouter
from .subscription_plan import router as plan_router
from .overview import router as overview_router
from .payment_history import router as payment_router
from .cancellation_insights import router as cancellation_router
from .subscription_logs import router as logs_router

router = APIRouter()

router.include_router(overview_router, prefix="/overview", tags=["subscription_overview"])
router.include_router(payment_router, prefix="/payment-history", tags=["payment_history"])
router.include_router(cancellation_router, prefix="/cancellation-insights", tags=["cancellation_insights"])
router.include_router(logs_router, prefix="/activity-logs", tags=["subscription_logs"])
router.include_router(plan_router, tags=["subscription_plan"])
