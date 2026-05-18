import uuid
from fastapi.testclient import TestClient
from app.models.otp import OTP
from app.models.user_device import UserDevice
from app.models.refresh_token import RefreshToken
from app.models.user import User


def make_unique_user_data() -> dict:
    suffix = uuid.uuid4().hex[:8]
    return {
        "email": f"testuser_{suffix}@example.com",
        "username": f"testuser_{suffix}",
        "full_name": "Test User",
        "password": "TestPass123!",
        "whatsapp_number": "+1234567890"
    }


class TestFullAuthFlow:
    def test_complete_auth_flow(self, client: TestClient, db_session):
        """Execute the full auth flow against the real database from .env."""
        user_data = make_unique_user_data()

        # Step 1: Register new user
        signup_response = client.post("/api/v2/auth/signup", json=user_data)
        assert signup_response.status_code == 201
        signup_data = signup_response.json()
        assert signup_data["success"] is True
        assert "verification code" in signup_data["message"]

        # Step 2: Read OTP from the database
        otp_record = (
            db_session.query(OTP)
            .filter(
                OTP.email == user_data["email"],
                OTP.otp_type == "email_verification",
                OTP.is_used == False
            )
            .order_by(OTP.expires_at.desc())
            .first()
        )
        assert otp_record is not None, "OTP record must exist after signup"

        # Step 3: Verify OTP and receive login response
        verify_response = client.post(
            "/api/v2/auth/verify-otp",
            json={"email": user_data["email"], "otp": otp_record.otp_code}
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["is_verified"] is True
        assert verify_data["access_token"]
        assert verify_data["expires_in"] > 0

        access_token = verify_data["access_token"]

        # Step 4: Call protected endpoint
        me_response = client.get(
            "/api/v2/auth/me",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        assert me_response.status_code == 200
        assert me_response.json()["email"] == user_data["email"]

        # Step 5: Login again with password
        login_response = client.post(
            "/api/v2/auth/login",
            json={
                "email": user_data["email"],
                "password": user_data["password"],
                "remember_me": False
            }
        )
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert login_data["email"] == user_data["email"]
        assert login_data["access_token"]
        assert login_data["user_id"]

        # Step 6: Refresh access token using the refresh cookie
        refresh_response = client.post("/api/v2/auth/refresh-token", json={})
        assert refresh_response.status_code == 200
        refresh_data = refresh_response.json()
        assert refresh_data["access_token"]
        assert refresh_data["expires_in"] > 0

        # Step 7: Request password reset via email OTP
        reset_request_response = client.post(
            "/api/v2/auth/password-reset",
            json={"email": user_data["email"]}
        )
        assert reset_request_response.status_code == 200
        assert "Password reset code sent to your email" in reset_request_response.json()["message"]

        reset_otp_record = (
            db_session.query(OTP)
            .filter(
                OTP.email == user_data["email"],
                OTP.otp_type == "password_reset",
                OTP.is_used == False
            )
            .order_by(OTP.expires_at.desc())
            .first()
        )
        assert reset_otp_record is not None

        reset_response = client.post(
            "/api/v2/auth/verify-password-reset",
            json={
                "email": user_data["email"],
                "otp": reset_otp_record.otp_code,
                "new_password": "NewPassword123!"
            }
        )
        assert reset_response.status_code == 200
        assert reset_response.json()["message"] == "Password reset successfully"

        # Step 8: Login with the new password
        login_response = client.post(
            "/api/v2/auth/login",
            json={
                "email": user_data["email"],
                "password": "NewPassword123!",
                "remember_me": False
            }
        )
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert login_data["email"] == user_data["email"]
        assert login_data["access_token"]
        assert login_data["user_id"]

        # Cleanup created user and related records from the real database
        user = db_session.query(User).filter(User.email == user_data["email"]).first()
        if user:
            db_session.query(OTP).filter(OTP.user_id == user.id).delete()
            db_session.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
            db_session.query(UserDevice).filter(UserDevice.user_id == user.id).delete()
            db_session.delete(user)
            db_session.commit()
