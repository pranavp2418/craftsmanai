from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.brand_setting import BrandSetting
from app.models.user import User
from app.repositories.brand_setting import BrandSettingRepository


class BrandSettingService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = BrandSettingRepository(db)

    def get_brand_settings(self, user_id: int) -> BrandSetting:
        setting = self.repository.get_by_user_id(user_id)
        if setting and setting.user:
            from app.models.subscription import UserSubscription, SubscriptionStatus, SubscriptionPlan
            from sqlalchemy import or_
            from datetime import datetime, timezone
            
            now = datetime.now(timezone.utc)
            
            # Query the database to check if this user has any active/valid subscription
            active_sub = self.db.query(UserSubscription).join(SubscriptionPlan).filter(
                UserSubscription.user_id == user_id,
                UserSubscription.is_queued == False,
                or_(
                    UserSubscription.status == SubscriptionStatus.ACTIVE,
                    UserSubscription.status == SubscriptionStatus.TRIAL,
                    (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
                )
            ).first()

            should_deactivate = False
            
            if not active_sub:
                # No active subscription means they have no branding allowed (defaults to Starter)
                should_deactivate = True
            else:
                plan = active_sub.plan.name if active_sub.plan else "Starter"
                plan_lower = plan.strip().lower()
                if plan_lower not in ("pro", "business"):
                    # Non-paid or other plans have no branding allowed
                    should_deactivate = True
                elif plan_lower == "pro":
                    # Pro plan only allows logo to be changed.
                    # If they have non-default custom fields set, then they have downgraded from Business.
                    has_custom_brand_name = False
                    if setting.brand_name and setting.brand_name.strip().lower() != "craftsman ai":
                        has_custom_brand_name = True
                    has_custom_email = setting.business_email != setting.user.email and setting.business_email is not None
                    has_custom_phone = setting.phone_number is not None
                    has_custom_color = setting.primary_color != "#6366F1" and setting.primary_color is not None
                    
                    if has_custom_brand_name or has_custom_email or has_custom_phone or has_custom_color:
                        should_deactivate = True
            
            if should_deactivate and not setting.is_deactivated:
                setting.is_deactivated = True
                self.db.commit()
                self.db.refresh(setting)
            elif not should_deactivate and setting.is_deactivated:
                setting.is_deactivated = False
                self.db.commit()
                self.db.refresh(setting)
                
        return setting

    def update_brand_settings(self, user: User, **kwargs) -> BrandSetting:
        """Update brand settings with strict plan-tier validations"""
        from app.models.subscription import UserSubscription, SubscriptionStatus, SubscriptionPlan
        from sqlalchemy import or_
        from datetime import datetime, timezone
        
        now = datetime.now(timezone.utc)
        
        # Query active subscription dynamically
        active_sub = self.db.query(UserSubscription).join(SubscriptionPlan).filter(
            UserSubscription.user_id == user.id,
            UserSubscription.is_queued == False,
            or_(
                UserSubscription.status == SubscriptionStatus.ACTIVE,
                UserSubscription.status == SubscriptionStatus.TRIAL,
                (UserSubscription.status == SubscriptionStatus.CANCELLED) & (UserSubscription.end_date >= now)
            )
        ).first()
        
        plan = active_sub.plan.name if (active_sub and active_sub.plan) else "Starter"
        plan_lower = plan.strip().lower()

        # 1. Non-paid or invalid plans block all branding updates
        if plan_lower not in ("pro", "business"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Custom branding is not available on your current plan. Please upgrade to Pro or Business."
            )

        # 2. Pro plan restrictions: ONLY logo is allowed, brand_name and others are blocked
        if plan_lower == "pro":
            unsupported_fields = []
            if kwargs.get("brand_name") is not None:
                unsupported_fields.append("Brand Name")
            if kwargs.get("business_email") is not None:
                unsupported_fields.append("Business Email")
            if kwargs.get("phone_number") is not None:
                unsupported_fields.append("Phone Number")
            if kwargs.get("primary_color") is not None:
                unsupported_fields.append("Primary Brand Color")

            if unsupported_fields:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Only the logo can be updated on the Pro plan. The following fields are restricted: {', '.join(unsupported_fields)}. Please upgrade to the Business plan for full custom branding."
                )

        # Process base64 logo_url upload if necessary
        logo_url = kwargs.get("logo_url")
        if logo_url:
            if logo_url.startswith("data:image/") or ";base64," in logo_url or len(logo_url) > 1000:
                from app.services.storage_service import upload_image_to_supabase
                bucket_path = f"brand_logos/user_{user.id}/logo"
                public_url = upload_image_to_supabase(logo_url, bucket_path)
                kwargs["logo_url"] = public_url

        # 3. Retrieve settings and apply update
        kwargs["is_deactivated"] = False
        setting = self.repository.get_by_user_id(user.id)
        return self.repository.update_brand_settings(setting, **kwargs)
