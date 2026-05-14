from fastapi import APIRouter

from .create_design import router as create_design_router
from .update_design import router as update_design_router
from .get_design import router as get_design_router
from .list_designs import router as list_designs_router
from .delete_design import router as delete_design_router
from .share_design import router as share_design_router


router = APIRouter(prefix="/design", tags=["design"])

router.include_router(create_design_router)
router.include_router(list_designs_router)
router.include_router(get_design_router)
router.include_router(update_design_router)
router.include_router(delete_design_router)
router.include_router(share_design_router)
