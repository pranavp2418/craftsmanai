from fastapi import APIRouter
from .get_manufacturers import router as all_manufacturers_router
from .get_summary import router as summary_router
from .disable_manufacturer import router as disable_router
from .enable_manufacturer import router as enable_router
from .get_detail import router as get_detail_router



router = APIRouter()

# Include customers routes
router.include_router(all_manufacturers_router)
router.include_router(summary_router)
router.include_router(disable_router)
router.include_router(enable_router)
router.include_router(get_detail_router)
