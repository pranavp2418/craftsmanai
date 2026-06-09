from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/2fa-status")
def get_two_factor_auth_status(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the current Two-Factor Authentication status for the logged-in user.
    """
    return {
        "is_2fa_enabled": current_user.is_2fa_enabled
    }