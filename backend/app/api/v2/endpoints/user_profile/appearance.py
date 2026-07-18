from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.user_profile import AppearanceSettingsUpdate, AppearanceSettingsResponse
from app.models.user import User

router = APIRouter()

@router.get("/appearance", response_model=AppearanceSettingsResponse, status_code=status.HTTP_200_OK)
def get_appearance_settings(
    *,
    current_user: User = Depends(get_current_user)
):
    """
    Get the current user's appearance settings (Theme, Navigation Color).
    """
    return AppearanceSettingsResponse(
        theme=current_user.theme or "System Preference",
        navigation_color=current_user.navigation_color or "Light"
    )

@router.put("/appearance", response_model=AppearanceSettingsResponse, status_code=status.HTTP_200_OK)
def update_appearance_settings(
    *,
    db: Session = Depends(get_db),
    appearance_data: AppearanceSettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update the current user's appearance settings.
    """
    if appearance_data.theme is not None:
        current_user.theme = appearance_data.theme
        
    if appearance_data.navigation_color is not None:
        current_user.navigation_color = appearance_data.navigation_color
        
    db.commit()
    db.refresh(current_user)

    return AppearanceSettingsResponse(
        theme=current_user.theme,
        navigation_color=current_user.navigation_color
    )
