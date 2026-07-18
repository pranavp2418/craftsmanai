from fastapi import APIRouter
from .retailer_susbcription import router as retailer_subscription_router
from .subscription_plans import router as subscription_plans_router
from .subscription_dashboard import router as subscription_dashboard_router
from .payment_history import router as payment_history_router
from .cancel_plan import router as cancel_plan_router

router = APIRouter()

# Include all subscription sub-routers
router.include_router(retailer_subscription_router)
router.include_router(subscription_plans_router)
router.include_router(subscription_dashboard_router)
router.include_router(payment_history_router)
router.include_router(cancel_plan_router)
 
