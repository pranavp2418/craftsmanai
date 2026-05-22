import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import TestingSessionLocal
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice
from app.models.notification_setting import NotificationSetting
from app.repositories.user import UserRepository
from app.core.security import create_access_token


def create_committed_user(email: str, username: str, full_name: str) -> User:
    """Helper to create a committed user in the real test DB"""
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
            session.query(User).filter(User.id == existing.id).delete()
            session.commit()
            
        user = user_repo.create_user(
            email=email,
            username=username,
            full_name=full_name,
            password="TestPass123!",
            is_verified=True,
        )
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
            session.query(User).filter(User.id == user.id).delete()
            session.commit()
    finally:
        session.close()


class TestNotificationSettings:
    def test_get_and_update_notification_settings(self, client: TestClient):
        """Test auto-initializing and partially updating notification settings"""
        email = "notif_test@example.com"
        try:
            user = create_committed_user(email=email, username="notiftest", full_name="Settings User")
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Fetch preferences (should automatically exist with all fields turned ON by default)
            response = client.get("/api/v2/notification-settings/", headers=headers)
            assert response.status_code == 200
            
            data = response.json()
            assert data["user_id"] == user.id
            assert data["email_notifications"] is True
            assert data["push_notifications"] is True
            assert data["design_approval_alerts"] is True
            assert data["manufacturer_updates"] is True
            assert data["quote_reminders"] is True  # ON by default on registration

            # 2. Update preferences (toggle some OFF)
            update_payload = {
                "email_notifications": False,
                "quote_reminders": False
            }
            res_update = client.put("/api/v2/notification-settings/", json=update_payload, headers=headers)
            assert res_update.status_code == 200
            
            data_updated = res_update.json()
            assert data_updated["email_notifications"] is False
            assert data_updated["quote_reminders"] is False
            assert data_updated["push_notifications"] is True  # Unchanged

            # 3. Retrieve settings again to ensure changes are correctly persisted
            res_get_again = client.get("/api/v2/notification-settings/", headers=headers)
            assert res_get_again.status_code == 200
            
            data_persisted = res_get_again.json()
            assert data_persisted["email_notifications"] is False
            assert data_persisted["quote_reminders"] is False
            assert data_persisted["push_notifications"] is True
        finally:
            cleanup_user_by_email(email)
