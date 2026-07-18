from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
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


def get_subscription_status(db: Session, user: User) -> tuple[bool, bool, str | None]:
    from app.services.subscription_service import SubscriptionService
    from app.models.subscription import UserSubscription, SubscriptionStatus, SubscriptionPlan
    from app.core.timezone import now as tz_now

    owner_id = SubscriptionService.get_subscription_owner_id(user)
    now = tz_now()
    
    subscription = db.query(UserSubscription).filter(
        UserSubscription.user_id == owner_id,
        UserSubscription.is_queued == False
    ).order_by(UserSubscription.created_at.desc()).first()

    subscription = SubscriptionService.check_and_update_subscription_expiry(db, subscription)

    if not subscription:
        return True, False, None

    is_active_status = subscription.status == SubscriptionStatus.ACTIVE
    is_cancelled_but_active = (subscription.status == SubscriptionStatus.CANCELLED) and (subscription.end_date >= now)
    is_active_sub = is_active_status or is_cancelled_but_active

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == subscription.plan_id).first()
    plan_name = plan.name if plan else None

    if is_active_sub:
        plan_expired = False
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

    return plan_expired, token_exhausted, plan_name


@router.put("/", response_model=UserProfileResponse)
def update_user_profile(
    *,
    db: Session = Depends(get_db),
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user)
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
    
    if profile_data.business_name is not None:
        stripped = profile_data.business_name.strip()
        if not stripped:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Business name cannot be empty"
            )
        current_user.business_name = stripped

    db.commit()
    db.refresh(current_user)

    # Re-calculate first and last name for response mapping
    final_first, final_last = split_full_name(current_user.full_name)
    role = "Admin" if current_user.is_superuser else "User"

    plan_expired, token_exhausted, plan_name = get_subscription_status(db, current_user)

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        first_name=final_first,
        last_name=final_last,
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


@router.post("/profile-picture", response_model=UserProfileResponse)
async def update_profile_picture(
    *,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and update/add the profile picture for the currently logged-in user.
    """
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty"
        )

    from app.services.storage_service import upload_image_to_supabase
    
    bucket_path = f"profile-pictures/user_{current_user.id}"
    try:
        url = upload_image_to_supabase(content, bucket_path)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile picture: {str(e)}"
        )

    current_user.profile_picture_url = url
    db.commit()
    db.refresh(current_user)

    final_first, final_last = split_full_name(current_user.full_name)
    role = "Admin" if current_user.is_superuser else "User"

    plan_expired, token_exhausted, plan_name = get_subscription_status(db, current_user)

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        first_name=final_first,
        last_name=final_last,
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
