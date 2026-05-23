from fastapi import APIRouter
from .get_retailers import router as get_all_retailers
from .retailer_status_update import router as retailer_status_update_router
from .get_retailer_info import router as get_retailer_details_router
from .create_retailer import router as create_retailer_router

router = APIRouter()

# Include dashboard routes
router.include_router(get_all_retailers)
router.include_router(get_retailer_details_router)
router.include_router(retailer_status_update_router)
router.include_router(create_retailer_router)
