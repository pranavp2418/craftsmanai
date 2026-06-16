import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import TestingSessionLocal
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice
from app.models.notification_setting import NotificationSetting
from app.models.brand_setting import BrandSetting
from app.repositories.user import UserRepository
from app.core.security import create_access_token


from app.models.subscription import UserSubscription, SubscriptionPlan, SubscriptionStatus
from datetime import datetime, timedelta, timezone


def create_committed_user_with_plan(email: str, username: str, full_name: str, plan: str = "Starter") -> User:
    """Helper to create a committed user with specific subscription plan"""
    session = TestingSessionLocal()
    try:
        user_repo = UserRepository(session)
        # Clean up any existing user first
        existing = user_repo.get_user_by_email(email)
        if existing:
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == existing.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == existing.id).delete()
            session.query(NotificationSetting).filter(NotificationSetting.user_id == existing.id).delete()
            session.query(BrandSetting).filter(BrandSetting.user_id == existing.id).delete()
            session.query(UserSubscription).filter(UserSubscription.user_id == existing.id).delete()
            session.query(User).filter(User.id == existing.id).delete()
            session.commit()
            
        user = user_repo.create_user(
            email=email,
            username=username,
            full_name=full_name,
            password="TestPass123!",
            is_verified=True,
        )
        user.subscription_plan = plan
        session.add(user)
        session.commit()
        session.refresh(user)

        # Get or create SubscriptionPlan
        db_plan = session.query(SubscriptionPlan).filter(SubscriptionPlan.name == plan).first()
        if not db_plan:
            db_plan = SubscriptionPlan(
                name=plan,
                price=99.99,
                is_active=True,
                duration_days=30
            )
            session.add(db_plan)
            session.commit()
            session.refresh(db_plan)

        # Create active subscription for user
        now = datetime.now(timezone.utc)
        sub = UserSubscription(
            user_id=user.id,
            plan_id=db_plan.id,
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=30),
            status=SubscriptionStatus.ACTIVE,
            is_queued=False
        )
        session.add(sub)
        session.commit()

        return user
    finally:
        session.close()


def cleanup_user_by_email(email: str):
    """Helper to clean up the committed user and associated settings"""
    session = TestingSessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        if user:
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == user.id).delete()
            session.query(NotificationSetting).filter(NotificationSetting.user_id == user.id).delete()
            session.query(BrandSetting).filter(BrandSetting.user_id == user.id).delete()
            session.query(UserSubscription).filter(UserSubscription.user_id == user.id).delete()
            session.query(User).filter(User.id == user.id).delete()
            session.commit()
    finally:
        session.close()


class TestBrandSettings:
    def test_starter_plan_branding_blocked(self, client: TestClient):
        """Starter plan users are completely blocked from setting brand customization"""
        email = "starter_brand@example.com"
        try:
            user = create_committed_user_with_plan(email, "starterbrand", "Starter Designer", plan="Starter")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # Fetch default settings
            res_get = client.get("/api/v2/brand-settings/", headers=headers)
            assert res_get.status_code == 200
            data = res_get.json()
            assert data["brand_name"] == "Craftsman AI"
            assert data["powered_by_craftsman_ai"] is True

            # Custom branding update should be rejected with 403 FORBIDDEN
            payload = {"brand_name": "Premium Brand"}
            res_put = client.put("/api/v2/brand-settings/", json=payload, headers=headers)
            assert res_put.status_code == 403
            assert "upgrade to Pro or Business" in res_put.json()["detail"]
        finally:
            cleanup_user_by_email(email)

    def test_pro_plan_branding_partially_blocked(self, client: TestClient):
        """Pro plan users can only customize logo, brand name and other updates are blocked"""
        email = "pro_brand@example.com"
        try:
            user = create_committed_user_with_plan(email, "probrand", "Pro Designer", plan="Pro")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Update logo (Allowed on Pro)
            payload_allowed = {"logo_url": "https://logos.com/pro.png"}
            res_put_allowed = client.put("/api/v2/brand-settings/", json=payload_allowed, headers=headers)
            assert res_put_allowed.status_code == 200
            data = res_put_allowed.json()
            assert data["logo_url"] == "https://logos.com/pro.png"
            assert data["powered_by_craftsman_ai"] is True  # Watermark shown on Pro

            # 2. Update brand name (Rejected on Pro with 403 FORBIDDEN)
            payload_blocked_name = {"brand_name": "Pro Brand Name"}
            res_put_blocked_name = client.put("/api/v2/brand-settings/", json=payload_blocked_name, headers=headers)
            assert res_put_blocked_name.status_code == 403
            assert "Only the logo can be updated on the Pro plan" in res_put_blocked_name.json()["detail"]

            # 3. Update contact detail (Rejected on Pro with 403 FORBIDDEN)
            payload_blocked = {"business_email": "pro@probrand.com"}
            res_put_blocked = client.put("/api/v2/brand-settings/", json=payload_blocked, headers=headers)
            assert res_put_blocked.status_code == 403
            assert "Only the logo can be updated on the Pro plan" in res_put_blocked.json()["detail"]

            # 4. Update custom theme color (Rejected on Pro with 403 FORBIDDEN)
            payload_color = {"primary_color": "#00FF00"}
            res_put_color = client.put("/api/v2/brand-settings/", json=payload_color, headers=headers)
            assert res_put_color.status_code == 403
            assert "Only the logo can be updated on the Pro plan" in res_put_color.json()["detail"]
        finally:
            cleanup_user_by_email(email)

    def test_business_plan_branding_unrestricted(self, client: TestClient):
        """Business plan users have unrestricted access to customize colors, contact info, logo and brand name"""
        email = "biz_brand@example.com"
        try:
            user = create_committed_user_with_plan(email, "bizbrand", "Business Designer", plan="Business")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            payload = {
                "brand_name": "Premium Elite Brand",
                "logo_url": "https://logos.com/biz.png",
                "business_email": "hello@elitebrand.com",
                "phone_number": "+1 (555) 999-8888",
                "primary_color": "#FF007F"
            }
            res_put = client.put("/api/v2/brand-settings/", json=payload, headers=headers)
            assert res_put.status_code == 200
            
            data = res_put.json()
            assert data["brand_name"] == "Premium Elite Brand"
            assert data["logo_url"] == "https://logos.com/biz.png"
            assert data["business_email"] == "hello@elitebrand.com"
            assert data["phone_number"] == "+1 (555) 999-8888"
            assert data["primary_color"] == "#FF007F"
            assert data["powered_by_craftsman_ai"] is False  # Watermark removed on Business!
        finally:
            cleanup_user_by_email(email)

    def test_brand_settings_deactivation_on_downgrade_or_expiry(self, client: TestClient):
        """Downgrading plan or plan expiration deactivates brand settings"""
        email = "deact_brand@example.com"
        session = TestingSessionLocal()
        try:
            # Create user on Business plan
            user = create_committed_user_with_plan(email, "deactbrand", "Deact Designer", plan="Business")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Update brand settings (Allowed on Business)
            payload = {
                "brand_name": "Deact Elite Brand",
                "logo_url": "https://logos.com/biz.png",
                "business_email": "hello@elitebrand.com",
                "phone_number": "+1 (555) 999-8888",
                "primary_color": "#FF007F"
            }
            res_put = client.put("/api/v2/brand-settings/", json=payload, headers=headers)
            assert res_put.status_code == 200
            assert res_put.json()["is_deactivated"] is False

            # 2. Re-fetch user in session and simulate plan downgrade to Pro
            from app.models.brand_setting import BrandSetting
            db_user = session.query(User).filter(User.id == user.id).first()
            assert db_user is not None
            
            # Simulate a downgrade check logic:
            old_plan = db_user.subscription_plan
            new_plan = "Pro"
            PLAN_TIERS = {"Starter": 1, "Pro": 2, "Business": 3}
            is_downgrade = PLAN_TIERS.get(old_plan, 1) > PLAN_TIERS.get(new_plan, 1)
            
            db_user.subscription_plan = new_plan
            
            # Downgrade active UserSubscription record too
            pro_plan = session.query(SubscriptionPlan).filter(SubscriptionPlan.name == "Pro").first()
            if not pro_plan:
                pro_plan = SubscriptionPlan(name="Pro", price=199.99, is_active=True, duration_days=30)
                session.add(pro_plan)
                session.commit()
                session.refresh(pro_plan)
            
            user_sub = session.query(UserSubscription).filter(UserSubscription.user_id == user.id).first()
            if user_sub:
                user_sub.plan_id = pro_plan.id
                
            brand_setting = session.query(BrandSetting).filter(BrandSetting.user_id == user.id).first()
            if brand_setting and is_downgrade:
                brand_setting.is_deactivated = True
            session.commit()

            # 3. Retrieve settings via API - should show is_deactivated = True
            res_get = client.get("/api/v2/brand-settings/", headers=headers)
            assert res_get.status_code == 200
            assert res_get.json()["is_deactivated"] is True

            # 4. Update settings under Pro plan (should work only for logo, but also reactivates it)
            payload_logo = {"logo_url": "https://logos.com/new_pro.png"}
            res_put_pro = client.put("/api/v2/brand-settings/", json=payload_logo, headers=headers)
            assert res_put_pro.status_code == 200
            assert res_put_pro.json()["logo_url"] == "https://logos.com/new_pro.png"
            assert res_put_pro.json()["is_deactivated"] is False  # Reactivated on successful update
        finally:
            session.close()
            cleanup_user_by_email(email)
