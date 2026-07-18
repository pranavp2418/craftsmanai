from fastapi import APIRouter
from .all_customers import router as customers_router
from .customer_details import router as customer_details_router
from .customer_kpi import router as customer_kpi_router
from app.api.v2.endpoints.customer.create_customer import router as create_customer_router

router = APIRouter()

# Include customers routes
router.include_router(customers_router)
router.include_router(customer_details_router)
router.include_router(customer_kpi_router)
router.include_router(create_customer_router)
