from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.brand_setting import BrandSettingResponse
from app.services.brand_setting_service import BrandSettingService
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=BrandSettingResponse)
def get_brand_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = BrandSettingService(db)
    return service.get_brand_settings(current_user.id)
