from fastapi import APIRouter

from .customer_access import router as customer_access_router
from .manufacturer_access import router as manufacturer_access_router
from .manufacturer_variant_access import router as manufacturer_variant_access_router
from .approve_design import router as approve_design_router
from .reject_design import router as reject_design_router
from .request_refinement import router as request_refinement_router
from .test_sms import router as test_sms_router


router = APIRouter(prefix="/public", tags=["public-access"])

router.include_router(customer_access_router)
router.include_router(manufacturer_access_router)
router.include_router(manufacturer_variant_access_router)
router.include_router(approve_design_router)
router.include_router(reject_design_router)
router.include_router(request_refinement_router)
router.include_router(test_sms_router)
