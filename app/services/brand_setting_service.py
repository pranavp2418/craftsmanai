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
        return self.repository.get_by_user_id(user_id)

    def update_brand_settings(self, user: User, **kwargs) -> BrandSetting:
        """Update brand settings with strict plan-tier validations"""
        plan = user.subscription_plan or "Starter"

        # 1. Starter Tier Restrictions
        if plan == "Starter":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Custom branding is not available on the Starter plan. Please upgrade to Pro or Business."
            )

        # 2. Pro Tier Restrictions
        if plan == "Pro":
            # Pro plan only supports logo_url and brand_name. Custom contact information and visual theme colors are blocked.
            unsupported_fields = []
            if kwargs.get("business_email") is not None:
                unsupported_fields.append("Business Email")
            if kwargs.get("phone_number") is not None:
                unsupported_fields.append("Phone Number")
            
            # primary_color can only be the default hex (#6366F1)
            primary_color = kwargs.get("primary_color")
            if primary_color is not None and primary_color.upper() != "#6366F1":
                unsupported_fields.append("Primary Brand Color")

            if unsupported_fields:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"The following settings are exclusive to the Business plan: {', '.join(unsupported_fields)}. Please upgrade your plan."
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
        setting = self.repository.get_by_user_id(user.id)
        return self.repository.update_brand_settings(setting, **kwargs)
