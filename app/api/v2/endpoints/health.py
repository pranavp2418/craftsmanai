from fastapi import APIRouter
from datetime import datetime

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": tz_now().isoformat(),
        "service": "craftmen-backend"
    }


@router.get("/endpoints/health")
async def endpoints_health_check():
    """Health check endpoint for backward compatibility"""
    return {
        "status": "healthy",
        "timestamp": tz_now().isoformat(),
        "service": "craftmen-backend"
    }
