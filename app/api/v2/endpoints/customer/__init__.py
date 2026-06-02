from fastapi import APIRouter

from .create_customer import router as create_router
from .update_customer import router as update_router
from .get_customer import router as get_router
from .list_customers import router as list_router
from .delete_customer import router as delete_router
from .customer_design_details import router as customer_track_router

router = APIRouter(prefix="/customer", tags=["customer"])

router.include_router(create_router)
router.include_router(update_router)
router.include_router(get_router)
router.include_router(list_router)
router.include_router(delete_router)
router.include_router(customer_track_router)
