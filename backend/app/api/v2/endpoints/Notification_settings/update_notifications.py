from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.notification_setting import NotificationSettingUpdateRequest, NotificationSettingResponse
from app.services.notification_setting_service import NotificationSettingService
from app.models.user import User

router = APIRouter()


@router.put("/", response_model=NotificationSettingResponse)
def update_notification_settings(
    request: NotificationSettingUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = NotificationSettingService(db)
    
    update_data = {}
    if request.email_notifications is not None:
        update_data["email_notifications"] = request.email_notifications
    if request.push_notifications is not None:
        update_data["push_notifications"] = request.push_notifications
    if request.design_approval_alerts is not None:
        update_data["design_approval_alerts"] = request.design_approval_alerts
    if request.manufacturer_updates is not None:
        update_data["manufacturer_updates"] = request.manufacturer_updates
    if request.quote_reminders is not None:
        update_data["quote_reminders"] = request.quote_reminders

    return service.update_settings(current_user.id, **update_data)
