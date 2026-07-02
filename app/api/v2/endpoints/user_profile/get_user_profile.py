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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the currently logged-in user's profile details.
    """
    from app.services.subscription_service import SubscriptionService
    from app.models.subscription import UserSubscription, SubscriptionStatus, SubscriptionPlan
    from sqlalchemy import or_
    from datetime import datetime, timezone

    first_name, last_name = split_full_name(current_user.full_name)
    role = "Admin" if current_user.is_superuser else "User"

    # Query latest subscription (active, expired, or cancelled)
    owner_id = SubscriptionService.get_subscription_owner_id(current_user)
    now = datetime.now(timezone.utc)
    
    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == owner_id,
        UserSubscription.is_queued == False
    ).order_by(UserSubscription.created_at.desc()).first()

    # Sync status
    subscription = SubscriptionService.check_and_update_subscription_expiry(db, subscription)

    if not subscription:
        plan_expired = True
        token_exhausted = False
        plan_name = None
    else:
        # Check if the subscription is currently active
        is_active_status = subscription.status == SubscriptionStatus.ACTIVE
        is_cancelled_but_active = (subscription.status == SubscriptionStatus.CANCELLED) and (subscription.end_date >= now)
        is_active_sub = is_active_status or is_cancelled_but_active

        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
        plan_name = plan.name if plan else None

        if is_active_sub:
            plan_expired = False
            # Check if plan has unlimited renders
            if plan and plan.has_unlimited_renders:
                token_exhausted = False
            else:
                limit = subscription.initial_monthly_renders
                used = subscription.used_monthly_renders or 0
                if limit != -1 and used >= limit:
                    token_exhausted = True
                else:
                    token_exhausted = False
        else:
            plan_expired = True
            token_exhausted = False
    
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        first_name=first_name,
        last_name=last_name,
        full_name=current_user.full_name,
        whatsapp_number=current_user.whatsapp_number,
        profile_picture_url=current_user.profile_picture_url,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        is_superuser=current_user.is_superuser,
        business_name=current_user.business_name,
        role=role,
        plan_expired=plan_expired,
        token_exhausted=token_exhausted,
        plan_name=plan_name
    )

