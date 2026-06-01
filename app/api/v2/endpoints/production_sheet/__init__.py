from fastapi import APIRouter

from .create_production_sheet import router as create_production_sheet_router
from .get_production_sheet import router as get_production_sheet_router
from .save_draft import router as save_draft_router


router = APIRouter(prefix="/production-sheet", tags=["production-sheet"])

router.include_router(create_production_sheet_router)
router.include_router(get_production_sheet_router)
router.include_router(save_draft_router)
