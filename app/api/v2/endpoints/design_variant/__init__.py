from fastapi import APIRouter

from .refine_design import router as refine_router
from .generate_angles import router as angles_router
from .generate_metal_variants import router as metals_router
from .select_variant import router as select_router
from .get_variant import router as get_router
from .list_variants import router as list_router


router = APIRouter(prefix="/design-variant", tags=["design-variant"])

router.include_router(refine_router)
router.include_router(angles_router)
router.include_router(metals_router)
router.include_router(select_router)
router.include_router(get_router)
router.include_router(list_router)
