import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from tests.conftest import TestingSessionLocal
from app.models.user import User
from app.models.otp import OTP
from app.models.refresh_token import RefreshToken
from app.models.user_device import UserDevice
from app.repositories.user import UserRepository
from app.core.security import create_access_token


def create_committed_user(email: str, username: str, full_name: str, whatsapp_number: str = "") -> User:
    """Helper to create a committed user in the real test DB (independent of transactional fixtures)"""
    session = TestingSessionLocal()
    try:
        user_repo = UserRepository(session)
        # Clean up any existing user first to avoid unique constraint violations
        existing = user_repo.get_user_by_email(email)
        if existing:
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
