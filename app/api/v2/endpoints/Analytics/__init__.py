from fastapi import APIRouter

from .activity_log import router as activity_log_router
from .jewellery_breakdown import router as jewellery_breakdown_router
from .conversion_funnel import router as conversion_funnel_router
from .get_completed_orders import router as get_completed_orders_router
from .get_design_time import router as get_design_time_router
from .get_metrics import router as get_metrics_router


router = APIRouter()

router.include_router(get_metrics_router)
router.include_router(get_design_time_router)
router.include_router(get_completed_orders_router)
router.include_router(conversion_funnel_router)
router.include_router(jewellery_breakdown_router)
router.include_router(activity_log_router)