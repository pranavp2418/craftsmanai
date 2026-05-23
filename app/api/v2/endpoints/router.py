from fastapi import APIRouter

# Import individual route modules here as they are created
from .auth import router as auth_router
from .health import router as health_router
from .websocket import router as websocket_router
from .sse import router as sse_router
from .design import router as design_router
from .design_variant import router as design_variant_router
from .customer import router as customer_router
from .manufacturer import router as manufacturer_router
from .order import router as order_router
from .quotes import router as quotes_router
from .public import router as public_router
from .team_settings import router as team_settings_router
from .user_profile import router as user_profile_router
from .Notification_settings import router as notification_settings_router

api_router = APIRouter()

# Register routers here
api_router.include_router(auth_router, prefix="/auth", tags=["authentication"])
api_router.include_router(health_router, prefix="/endpoints", tags=["health"])
api_router.include_router(websocket_router, prefix="/endpoints", tags=["websocket"])
api_router.include_router(sse_router, prefix="/endpoints", tags=["sse"])
api_router.include_router(design_router)
api_router.include_router(design_variant_router)
api_router.include_router(customer_router)
api_router.include_router(manufacturer_router)
api_router.include_router(order_router)
api_router.include_router(quotes_router)
api_router.include_router(public_router)
api_router.include_router(team_settings_router)
api_router.include_router(user_profile_router)
api_router.include_router(notification_settings_router)
from .brand_settings import router as brand_settings_router
api_router.include_router(brand_settings_router)

# --- ADMIN DOMAIN ROUTERS ---
from .admin.requests import router as admin_requests_router
from .admin.dashboard import router as admin_dashboard_router
from .admin.customers import router as admin_customers_router
from .admin.retailers import router as admin_retailers_router
from .admin.manufacturers import router as admin_manufacturers_router
from .admin.settings import router as admin_settings_router

api_router.include_router(admin_requests_router, prefix="/admin/requests", tags=["admin_requests"])
api_router.include_router(admin_dashboard_router, prefix="/admin/dashboard", tags=["admin_dashboard"])
api_router.include_router(admin_customers_router, prefix="/admin/customers", tags=["admin_customers"])
api_router.include_router(admin_retailers_router, prefix="/admin/retailers", tags=["admin_retailers"])
api_router.include_router(admin_manufacturers_router, prefix="/admin/manufacturers", tags=["admin_manufacturers"])
api_router.include_router(admin_settings_router, prefix="/admin/settings", tags=["admin_settings"])

from .admin.subscription_plan import router as admin_subscription_router
api_router.include_router(admin_subscription_router, prefix="/admin/subscription-plans", tags=["admin_subscription_plans"])

from .reatiler_subscription import router as retailer_subscription_router
api_router.include_router(retailer_subscription_router, prefix="/retailer/subscriptions", tags=["retailer_subscriptions"])


