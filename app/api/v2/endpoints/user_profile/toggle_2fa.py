from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.user_profile import TwoFactorAuthToggleRequest
from app.models.user import User

router = APIRouter()

@router.post("/toggle-2fa", status_code=status.HTTP_200_OK)
def toggle_two_factor_auth(
    *,
    db: Session = Depends(get_db),
    tfa_data: TwoFactorAuthToggleRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Toggle Two-Factor Authentication for the currently logged-in user.
    """
    current_user.is_2fa_enabled = tfa_data.enable_2fa
    db.commit()

    action = "enabled" if tfa_data.enable_2fa else "disabled"
    return {"message": f"Two-Factor Authentication {action} successfully"}
