from fastapi import APIRouter
from .get_invoice import router as get_invoice_router
from .download_invoice import router as download_invoice_router

router = APIRouter()

# Include all the routes from get_invoice and download_invoice
router.include_router(get_invoice_router)
router.include_router(download_invoice_router)
