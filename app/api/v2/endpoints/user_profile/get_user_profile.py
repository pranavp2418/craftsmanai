from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.user_profile import UserProfileResponse
from app.models.user import User

router = APIRouter()


def split_full_name(full_name: str | None) -> tuple[str, str]:
    if not full_name:
        return "", ""
    parts = full_name.strip().split(maxsplit=1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


@router.get("/", response_model=UserProfileResponse)
def get_user_profile(
    current_user: User = Depends(get_current_user)
):
    """
    Get the currently logged-in user's profile details.
    """
    first_name, last_name = split_full_name(current_user.full_name)
    role = "Admin" if current_user.is_superuser else "User"
    
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        first_name=first_name,
        last_name=last_name,
        full_name=current_user.full_name,
        whatsapp_number=current_user.whatsapp_number,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        is_superuser=current_user.is_superuser,
        role=role
    )
