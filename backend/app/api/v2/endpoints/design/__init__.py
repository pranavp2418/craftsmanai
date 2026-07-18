from fastapi import APIRouter

from .create_design import router as create_design_router
from .update_design import router as update_design_router
from .get_design import router as get_design_router
from .list_designs import router as list_designs_router
from .delete_design import router as delete_design_router
from .share_design import router as share_design_router
from .complete_design import router as complete_design_router

from .archive_design import router as archive_design_router
from .restore_design import router as restore_design_router
from .list_archived_designs import router as list_archived_designs_router
from .download_render import router as download_render_router


router = APIRouter(prefix="/design", tags=["design"])

router.include_router(create_design_router)
router.include_router(list_designs_router)
router.include_router(list_archived_designs_router)
router.include_router(archive_design_router)
router.include_router(restore_design_router)
router.include_router(get_design_router)
router.include_router(update_design_router)
router.include_router(delete_design_router)
router.include_router(share_design_router)
router.include_router(complete_design_router)
router.include_router(download_render_router)
