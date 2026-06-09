from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.user_profile import ChangePasswordRequest
from app.models.user import User
from app.core.security import verify_password, get_password_hash

router = APIRouter()

@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    *,
    db: Session = Depends(get_db),
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Change the current user's password.
    """
    if password_data.new_password != password_data.confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match"
        )

    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    return {"message": "Password updated successfully"}
