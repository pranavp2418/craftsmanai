import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from tests.conftest import TestingSessionLocal
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice
from app.repositories.user import UserRepository
from app.core.security import create_access_token


from sqlalchemy import text

def create_committed_user(email: str, username: str, full_name: str, whatsapp_number: str = "") -> User:
    """Helper to create a committed user in the real test DB (independent of transactional fixtures)"""
    session = TestingSessionLocal()
    try:
        user_repo = UserRepository(session)
        # Clean up any existing user first to avoid unique constraint violations
        existing = user_repo.get_user_by_email(email)
        if existing:
            session.execute(text("DELETE FROM brand_settings WHERE user_id = :uid"), {"uid": existing.id})
            session.execute(text("DELETE FROM notification_settings WHERE user_id = :uid"), {"uid": existing.id})
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == existing.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == existing.id).delete()
            session.query(User).filter(User.id == existing.id).delete()
            session.commit()
            
        user = user_repo.create_user(
            email=email,
            username=username,
            full_name=full_name,
            password="TestPass123!",
            is_verified=True,
            whatsapp_number=whatsapp_number
        )
        session.commit()
        session.refresh(user)
        return user
    finally:
        session.close()


def cleanup_user_by_email(email: str):
    """Helper to clean up the committed user after test run"""
    session = TestingSessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        if user:
            session.execute(text("DELETE FROM brand_settings WHERE user_id = :uid"), {"uid": user.id})
            session.execute(text("DELETE FROM notification_settings WHERE user_id = :uid"), {"uid": user.id})
            session.query(OTP).filter(OTP.email == email).delete()
            session.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
            session.query(UserDevice).filter(UserDevice.user_id == user.id).delete()
            session.query(User).filter(User.id == user.id).delete()
            session.commit()
    finally:
        session.close()


class TestUserProfile:
    """Test Suite for User Profile GET and PUT endpoints"""

    def test_get_user_profile_success(self, client: TestClient):
        """Test fetching the logged-in user's profile details"""
        email = "profile_get@example.com"
        try:
            user = create_committed_user(
                email=email,
                username="getprofile",
                full_name="John Doe",
                whatsapp_number="+14155550192"
            )
            
            # Generate token
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}
            
            # GET profile
            response = client.get("/api/v2/user-profile", headers=headers)
            assert response.status_code == 200
            
            data = response.json()
            assert data["email"] == "profile_get@example.com"
            assert data["username"] == "getprofile"
            assert data["first_name"] == "John"
            assert data["last_name"] == "Doe"
            assert data["full_name"] == "John Doe"
            assert data["whatsapp_number"] == "+14155550192"
            assert data["is_active"] is True
            assert data["is_verified"] is True
            assert data["role"] == "User"
        finally:
            cleanup_user_by_email(email)

    def test_get_user_profile_unauthorized(self, client: TestClient):
        """Test getting profile without credentials or with an invalid token"""
        # Completely missing Authorization header raises 401 Unauthorized due to manually raising HTTPException when missing
        response = client.get("/api/v2/user-profile")
        assert response.status_code == 401
        
        # Invalid Authorization header passes HTTPBearer check but fails validation inside get_current_user (401 Unauthorized)
        headers = {"Authorization": "Bearer invalidtoken"}
        response = client.get("/api/v2/user-profile", headers=headers)
        assert response.status_code == 401

    def test_update_user_profile_success(self, client: TestClient):
        """Test successfully updating profile details"""
        email = "profile_update@example.com"
        try:
            user = create_committed_user(
                email=email,
                username="updateprofile",
                full_name="Old Name",
                whatsapp_number="+10000000000"
            )
            
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}
            
            update_data = {
                "first_name": "Jane",
                "last_name": "Smith",
                "whatsapp_number": "+14155550193",
                "username": "newusername"
            }
            
            # PUT profile
            response = client.put("/api/v2/user-profile", json=update_data, headers=headers)
            assert response.status_code == 200
            
            data = response.json()
            assert data["username"] == "newusername"
            assert data["first_name"] == "Jane"
            assert data["last_name"] == "Smith"
            assert data["full_name"] == "Jane Smith"
            assert data["whatsapp_number"] == "+14155550193"
        finally:
            cleanup_user_by_email(email)
            cleanup_user_by_email("profile_update@example.com")

    def test_update_user_profile_duplicate_username(self, client: TestClient):
        """Test updating profile to a username that is already taken by another user"""
        email1 = "user1@example.com"
        email2 = "user2@example.com"
        try:
            user1 = create_committed_user(
                email=email1,
                username="userone",
                full_name="User One"
            )
            user2 = create_committed_user(
                email=email2,
                username="usertwo",
                full_name="User Two"
            )
            
            token = create_access_token(data={"sub": str(user1.id), "email": user1.email})
            headers = {"Authorization": f"Bearer {token}"}
            
            # Try to change user1's username to user2's username ("usertwo")
            update_data = {
                "username": "usertwo"
            }
            
            response = client.put("/api/v2/user-profile", json=update_data, headers=headers)
            assert response.status_code == 400
            assert "Username is already taken" in response.json()["detail"]
        finally:
            cleanup_user_by_email(email1)
            cleanup_user_by_email(email2)

    @patch("app.services.storage_service.upload_image_to_supabase")
    def test_upload_profile_picture_success(self, mock_upload, client: TestClient):
        """Test successfully uploading/updating user profile picture"""
        email = "profile_pic@example.com"
        mock_upload.return_value = "https://supabase.co/profile-pictures/user_123/image_abc.png"
        try:
            user = create_committed_user(
                email=email,
                username="picuser",
                full_name="Pic User"
            )
            
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}
            
            # Simulate a file upload
            file_data = {"file": ("test_pic.png", b"dummy_png_bytes", "image/png")}
            
            response = client.post(
                "/api/v2/user-profile/profile-picture", 
                files=file_data, 
                headers=headers
            )
            assert response.status_code == 200
            
            data = response.json()
            assert data["profile_picture_url"] == "https://supabase.co/profile-pictures/user_123/image_abc.png"
            
            # Check the DB value directly
            session = TestingSessionLocal()
            db_user = session.query(User).filter(User.id == user.id).first()
            assert db_user.profile_picture_url == "https://supabase.co/profile-pictures/user_123/image_abc.png"
            session.close()
        finally:
            cleanup_user_by_email(email)

    def test_update_user_profile_xss_validation_fail(self, client: TestClient):
        """Test that updating username, first_name, or last_name with XSS characters fails validation"""
        email = "profile_xss@example.com"
        try:
            user = create_committed_user(
                email=email,
                username="xssuser",
                full_name="Normal User"
            )
            
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}
            
            # XSS scripts in first_name/last_name
            bad_data = {
                "first_name": "<script>alert('XSS')</script>"
            }
            response = client.put("/api/v2/user-profile", json=bad_data, headers=headers)
            assert response.status_code == 422
            
            # Special chars in username
            bad_data_2 = {
                "username": "user<script>"
            }
            response = client.put("/api/v2/user-profile", json=bad_data_2, headers=headers)
            assert response.status_code == 422

            # Text/script in whatsapp_number
            bad_data_3 = {
                "whatsapp_number": "&lt;script&gt;"
            }
            response = client.put("/api/v2/user-profile", json=bad_data_3, headers=headers)
            assert response.status_code == 422
        finally:
            cleanup_user_by_email(email)

    def test_update_user_profile_business_name_sanitized(self, client: TestClient):
        """Test that XSS scripts in business_name are sanitized/escaped safely"""
        email = "profile_sanitize@example.com"
        try:
            user = create_committed_user(
                email=email,
                username="sanitizeuser",
                full_name="Normal User"
            )
            
            token = create_access_token(data={"sub": str(user.id), "email": user.email})
            headers = {"Authorization": f"Bearer {token}"}
            
            update_data = {
                "business_name": "<script>alert('XSS')</script>"
            }
            response = client.put("/api/v2/user-profile", json=update_data, headers=headers)
            assert response.status_code == 200
            
            data = response.json()
            # Verify that <script> is escaped to &lt;script&gt;
            assert "&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;" in data["business_name"]
            
            # Check DB directly
            session = TestingSessionLocal()
            db_user = session.query(User).filter(User.id == user.id).first()
            assert "&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;" in db_user.business_name
            session.close()
        finally:
            cleanup_user_by_email(email)
