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
            from app.core.timezone import now as tz_now
            
            now = tz_now()
            
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
            
            # Get plan object to check feature flags
            plan_obj = active_sub.plan if (active_sub and active_sub.plan) else None
            
            if not plan_obj:
                # No active subscription means they have no branding allowed
                should_deactivate = True
            else:
                # Deactivate if plan doesn't allow logo at all
                if not plan_obj.can_use_logo:
                    # Check if user has any non-default branding set (downgraded from higher plan)
                    has_any_branding = (
                        (setting.brand_name and setting.brand_name.strip().lower() != "craftsman ai") or
                        (setting.business_email != setting.user.email and setting.business_email is not None) or
                        (setting.phone_number is not None) or
                        (setting.primary_color != "#6366F1" and setting.primary_color is not None) or
                        (setting.logo_url is not None)
                    )
                    if has_any_branding:
                        should_deactivate = True
                else:
                    # Logo is allowed - check if user has custom fields that their plan doesn't support
                    if setting.brand_name and setting.brand_name.strip().lower() != "craftsman ai":
                        if not plan_obj.can_use_brand_name:
                            should_deactivate = True
                    if setting.primary_color != "#6366F1" and setting.primary_color is not None:
                        if not plan_obj.can_use_custom_color:
                            should_deactivate = True
                    if setting.business_email != setting.user.email and setting.business_email is not None:
                        if not plan_obj.can_use_brand_name:
                            should_deactivate = True
                    if setting.phone_number is not None:
                        if not plan_obj.can_use_brand_name:
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
        from app.core.timezone import now as tz_now
        
        now = tz_now()
        
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
        
        # Get plan object to check feature flags
        plan_obj = active_sub.plan if (active_sub and active_sub.plan) else None

        # 1. Check logo permission
        if kwargs.get("logo_url") is not None:
            if not plan_obj or not plan_obj.can_use_logo:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Logo customization is not available on your current plan. Please upgrade to a plan that supports custom logos."
                )
        
        # 2. Check brand name permission
        if kwargs.get("brand_name") is not None:
            if not plan_obj or not plan_obj.can_use_brand_name:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Brand name customization is not available on your current plan. Please upgrade to a plan that supports custom brand names."
                )
        
        # 3. Check custom color permission
        if kwargs.get("primary_color") is not None:
            if not plan_obj or not plan_obj.can_use_custom_color:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Custom color customization is not available on your current plan. Please upgrade to a plan that supports custom colors."
                )
        
        # 4. Check business email permission
        if kwargs.get("business_email") is not None:
            if not plan_obj or not plan_obj.can_use_brand_name:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Business email customization is not available on your current plan. Please upgrade to a plan that supports full branding."
                )
        
        # 5. Check phone number permission
        if kwargs.get("phone_number") is not None:
            if not plan_obj or not plan_obj.can_use_brand_name:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Phone number customization is not available on your current plan. Please upgrade to a plan that supports full branding."
                )
        
        # 6. Check if any field is being updated without plan permissions
        if not plan_obj:
            if any(v is not None for v in kwargs.values()):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="An active subscription is required to update brand settings."
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
