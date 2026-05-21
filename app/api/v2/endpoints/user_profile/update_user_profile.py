from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.user_profile import UserProfileResponse, UserProfileUpdate
from app.models.user import User

router = APIRouter()


def split_full_name(full_name: str | None) -> tuple[str, str]:
    if not full_name:
        return "", ""
    parts = full_name.strip().split(maxsplit=1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


@router.put("/", response_model=UserProfileResponse)
def update_user_profile(
    *,
    db: Session = Depends(get_db),
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """
    Update the currently logged-in user's profile details.
    """
    # 1. Update username if provided and changed
    if profile_data.username is not None:
        new_username = profile_data.username.strip()
        if new_username != current_user.username:
            # Check if username is already taken by another user
            existing_user = db.query(User).filter(User.username == new_username).first()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username is already taken"
                )
            current_user.username = new_username

    # 2. Update full name if first_name or last_name is provided
    current_first, current_last = split_full_name(current_user.full_name)
    
    first_name = profile_data.first_name if profile_data.first_name is not None else current_first
    last_name = profile_data.last_name if profile_data.last_name is not None else current_last
    
    new_full_name = f"{first_name.strip()} {last_name.strip()}".strip()
    if new_full_name:
        current_user.full_name = new_full_name
    else:
        current_user.full_name = None

    # 3. Update WhatsApp / Phone Number if provided
    if profile_data.whatsapp_number is not None:
        current_user.whatsapp_number = profile_data.whatsapp_number.strip()

    db.commit()
    db.refresh(current_user)

    # Re-calculate first and last name for response mapping
    final_first, final_last = split_full_name(current_user.full_name)
    role = "Admin" if current_user.is_superuser else "User"

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        first_name=final_first,
        last_name=final_last,
        full_name=current_user.full_name,
        whatsapp_number=current_user.whatsapp_number,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        is_superuser=current_user.is_superuser,
        role=role
    )
