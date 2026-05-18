import pytest
import uuid
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from tests.conftest import override_get_db
from app.models.otp import OTP
from app.models.user import User

class TestVerifyOTPWelcomeEmail:
    """Test verification of OTP and queuing of welcome email"""

    @patch('app.tasks.email_tasks.send_welcome_email')
    def test_verify_otp_sends_welcome_email_to_new_user(self, mock_send_welcome_email, client: TestClient):
        """Test that welcome email is queued when an unverified user successfully verifies their OTP for the first time"""
        # Step 1: Generate unique user data
        suffix = uuid.uuid4().hex[:8]
        unique_email = f"new_welcome_{suffix}@example.com"
        unique_username = f"new_welcome_{suffix}".split('@')[0]

        signup_data = {
            "email": unique_email,
            "password": "TestPass123!",
            "whatsapp_number": "+1234567890"
        }

        # Step 2: Register the user via client (this will generate an OTP and set is_verified=False)
        response = client.post("/api/v2/auth/signup", json=signup_data)
        assert response.status_code == 201

        # Step 3: Get OTP from database
        db = next(override_get_db())
        try:
            otp_record = db.query(OTP).filter(
                OTP.email == unique_email,
                OTP.otp_type == "email_verification",
                OTP.is_used == False
            ).order_by(OTP.expires_at.desc()).first()
            
            assert otp_record is not None, "OTP record must exist after signup"
            otp_code = otp_record.otp_code

            # Step 4: Mock the send_welcome_email task
            mock_delay = MagicMock()
            mock_send_welcome_email.delay = mock_delay

            # Step 5: Verify OTP via POST request
            verify_data = {
                "email": unique_email,
                "otp": otp_code
            }
            response = client.post("/api/v2/auth/verify-otp", json=verify_data)
            assert response.status_code == 200
            
            # Step 6: Check response fields
            resp_json = response.json()
            assert resp_json["email"] == unique_email
            assert resp_json["is_verified"] is True

            # Step 7: Verify welcome email was queued via Celery delay
            mock_delay.assert_called_once_with(
                to=unique_email,
                user_name=unique_username
            )
        finally:
            db.close()

    @patch('app.tasks.email_tasks.send_welcome_email')
    def test_verify_otp_sends_welcome_email_on_subsequent_verifications(self, mock_send_welcome_email, client: TestClient):
        """Test that welcome email is queued even if the user is already verified (subsequent OTP verification)"""
        # Step 1: Generate unique user data
        suffix = uuid.uuid4().hex[:8]
        unique_email = f"subsequent_verify_{suffix}@example.com"

        signup_data = {
            "email": unique_email,
            "password": "TestPass123!",
            "whatsapp_number": "+1234567890"
        }

        # Step 2: Register the user via client
        response = client.post("/api/v2/auth/signup", json=signup_data)
        assert response.status_code == 201

        # Step 3: Get first OTP and verify it to make the user verified
        db = next(override_get_db())
        try:
            otp_record = db.query(OTP).filter(
                OTP.email == unique_email,
                OTP.otp_type == "email_verification",
                OTP.is_used == False
            ).order_by(OTP.expires_at.desc()).first()
            
            assert otp_record is not None
            otp_code = otp_record.otp_code

            # Verify once to make the user verified
            verify_response = client.post("/api/v2/auth/verify-otp", json={
                "email": unique_email,
                "otp": otp_code
            })
            assert verify_response.status_code == 200
            assert verify_response.json()["is_verified"] is True

            # Step 4: Generate a second OTP (simulating a resend or subsequent verification)
            from app.services.auth import AuthService
            auth_service = AuthService(db)
            
            # Fetch the user to get their ID
            user = db.query(User).filter(User.email == unique_email).first()
            assert user is not None
            
            new_otp_code = auth_service.generate_and_save_otp(unique_email, "email_verification", user.id)

            # Step 5: Mock the send_welcome_email task
            mock_delay = MagicMock()
            mock_send_welcome_email.delay = mock_delay

            # Step 6: Verify the second OTP
            verify_data = {
                "email": unique_email,
                "otp": new_otp_code
            }
            response = client.post("/api/v2/auth/verify-otp", json=verify_data)
            assert response.status_code == 200
            
            # Step 7: Check response fields
            resp_json = response.json()
            assert resp_json["is_verified"] is True

            # Step 8: Verify welcome email was queued again on subsequent verification
            mock_delay.assert_called_once()
        finally:
            db.close()
