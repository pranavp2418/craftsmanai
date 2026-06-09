from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.notification_setting import NotificationSettingResponse
from app.services.notification_setting_service import NotificationSettingService
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=NotificationSettingResponse)
def get_notification_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = NotificationSettingService(db)
    return service.get_settings(current_user.id)
