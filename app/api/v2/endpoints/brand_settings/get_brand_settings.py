from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.brand_setting import BrandSettingResponse
from app.services.brand_setting_service import BrandSettingService
from app.models.user import User
from app.models.subscription import UserSubscription, SubscriptionPlan, SubscriptionStatus
from sqlalchemy import or_
from datetime import datetime, timezone

router = APIRouter()


@router.get("/", response_model=BrandSettingResponse)
def get_brand_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = BrandSettingService(db)
    setting = service.get_brand_settings(current_user.id)
    
    # Get feature flags from active subscription plan
    can_use_logo = False
    can_use_brand_name = False
    can_use_custom_color = False
    
    now = datetime.now(timezone.utc)
    active_sub = db.query(UserSubscription).join(SubscriptionPlan).filter(
        UserSubscription.user_id == current_user.id,
        UserSubscription.is_queued == False,
        or_(
            UserSubscription.status == SubscriptionStatus.ACTIVE,
            UserSubscription.status == SubscriptionStatus.TRIAL,
            (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
        )
    ).order_by(UserSubscription.end_date.desc()).first()
    
    if active_sub and active_sub.plan:
        plan = active_sub.plan
        can_use_logo = plan.can_use_logo
        can_use_brand_name = plan.can_use_brand_name
        can_use_custom_color = plan.can_use_custom_color
    
    # Convert to dict and add feature flags
    result = {
        "user_id": setting.user_id,
        "brand_name": setting.brand_name if can_use_brand_name else "CraftsmnaAI",
        "logo_url": setting.logo_url,
        "business_email": setting.business_email,
        "phone_number": setting.phone_number,
        "primary_color": setting.primary_color,
        "powered_by_craftsman_ai": setting.powered_by_craftsman_ai if hasattr(setting, 'powered_by_craftsman_ai') else True,
        "is_deactivated": setting.is_deactivated,
        "can_use_logo": can_use_logo,
        "can_use_brand_name": can_use_brand_name,
        "can_use_custom_color": can_use_custom_color,
        "updated_at": setting.updated_at
    }
    
    return BrandSettingResponse.model_validate(result)
