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
        """Pro plan users can only customize logo and name, other visual and contact updates are blocked"""
        email = "pro_brand@example.com"
        try:
            user = create_committed_user_with_plan(email, "probrand", "Pro Designer", plan="Pro")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Update logo and brand name (Allowed on Pro)
            payload_allowed = {"brand_name": "Pro Brand Name", "logo_url": "https://logos.com/pro.png"}
            res_put_allowed = client.put("/api/v2/brand-settings/", json=payload_allowed, headers=headers)
            assert res_put_allowed.status_code == 200
            data = res_put_allowed.json()
            assert data["brand_name"] == "Pro Brand Name"
            assert data["logo_url"] == "https://logos.com/pro.png"
            assert data["powered_by_craftsman_ai"] is True  # Watermark shown on Pro

            # 2. Update contact detail (Rejected on Pro with 403 FORBIDDEN)
            payload_blocked = {"business_email": "pro@probrand.com"}
            res_put_blocked = client.put("/api/v2/brand-settings/", json=payload_blocked, headers=headers)
            assert res_put_blocked.status_code == 403
            assert "exclusive to the Business plan" in res_put_blocked.json()["detail"]

            # 3. Update custom theme color (Rejected on Pro with 403 FORBIDDEN)
            payload_color = {"primary_color": "#00FF00"}
            res_put_color = client.put("/api/v2/brand-settings/", json=payload_color, headers=headers)
            assert res_put_color.status_code == 403
            assert "Primary Brand Color" in res_put_color.json()["detail"]
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
