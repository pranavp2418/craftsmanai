from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.brand_setting import BrandSettingUpdateRequest, BrandSettingResponse
from app.services.brand_setting_service import BrandSettingService
from app.models.user import User

router = APIRouter()


@router.put("/", response_model=BrandSettingResponse)
def update_brand_settings(
    request: BrandSettingUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BrandSettingService(db)
    
    update_data = {}
    if request.brand_name is not None:
        update_data["brand_name"] = request.brand_name
    if request.logo_url is not None:
        update_data["logo_url"] = request.logo_url
    if request.business_email is not None:
        update_data["business_email"] = request.business_email
    if request.phone_number is not None:
        update_data["phone_number"] = request.phone_number
    if request.primary_color is not None:
        update_data["primary_color"] = request.primary_color

    setting = service.update_brand_settings(current_user, **update_data)
    return BrandSettingResponse.model_validate(setting)
