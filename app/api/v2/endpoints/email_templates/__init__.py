from fastapi import APIRouter
from .create_template import router as create_template_router
from .get_template import router as get_template_router
from .update_template import router as update_template_router
from .delete_template import router as delete_template_router
from .list_templates import router as list_templates_router

router = APIRouter()

# Include all email template routers
router.include_router(create_template_router)
router.include_router(get_template_router)
router.include_router(update_template_router)
router.include_router(delete_template_router)
router.include_router(list_templates_router)