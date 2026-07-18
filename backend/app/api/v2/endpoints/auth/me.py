from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.auth import UserResponse
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: Any = Depends(get_current_user)
) -> Any:
    """Get current user information"""
    return UserResponse.from_orm(current_user)
