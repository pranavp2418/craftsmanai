from fastapi import APIRouter

from .speech_to_text import router as speech_to_text_router

router = APIRouter()
router.include_router(speech_to_text_router)
