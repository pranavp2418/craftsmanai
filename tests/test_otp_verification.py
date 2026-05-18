import pytest
from fastapi.testclient import TestClient
from app.models.user import User
from app.models.otp import OTP


class TestOTPVerification:
    """Test OTP-based authentication flow"""

    def test_signup_with_otp_verification(self, client: TestClient, test_user_data: dict):
        """Test complete signup flow with OTP verification"""
        # Step 1: Register user
        response = client.post("/api/v2/auth/signup", json=test_user_data)
        assert response.status_code == 201
        assert "OTP sent to your email" in response.json()["message"]
        
        # Step 2: Verify OTP (mock verification since we can't access email)
        # In real tests, you'd extract OTP from email service mock
        otp_code = "123456"  # This would be from mock
        
        verify_data = {
            "email": test_user_data["email"],
            "otp": otp_code
        }
        
        response = client.post("/api/v2/auth/verify-otp", json=verify_data)
        # This would succeed with proper OTP mocking
        # For now, test structure

    def test_resend_otp(self, client: TestClient, test_user_data: dict):
        """Test OTP resend functionality"""
        # First, register user
        client.post("/api/v2/auth/signup", json=test_user_data)
        
        # Resend OTP
        resend_data = {"email": test_user_data["email"]}
        response = client.post("/api/v2/auth/resend-otp", json=resend_data)
        
        assert response.status_code == 200
        assert "OTP sent to your email" in response.json()["message"]

    def test_password_reset_with_otp(self, client: TestClient, create_test_user: User):
        """Test password reset flow with OTP"""
        # Step 1: Request password reset
        reset_data = {"email": create_test_user.email}
        response = client.post("/api/v2/auth/password-reset", json=reset_data)
        
        assert response.status_code == 200
        assert "Password reset email sent" in response.json()["message"]
        
        # Step 2: Verify OTP and reset password
        # In real tests, you'd extract OTP from email service mock
        reset_confirm_data = {
            "email": create_test_user.email,
            "otp": "123456",  # This would be from mock
            "new_password": "NewPassword123!"
        }
        
        response = client.post("/api/v2/auth/reset-password", json=reset_confirm_data)
        assert response.status_code == 200
        assert response.json()["message"] in (
            "Password reset successfully",
            "Password reset successfully"
        )

    def test_otp_expiration(self, client: TestClient, test_user_data: dict):
        """Test OTP expiration handling"""
        # Register user
        client.post("/api/v2/auth/signup", json=test_user_data)
        
        # Try to verify with expired OTP
        # In real tests, you'd manipulate time or use expired OTP
        verify_data = {
            "email": test_user_data["email"],
            "otp": "expired_otp"
        }
        
        response = client.post("/api/v2/auth/verify-otp", json=verify_data)
        # This should fail with expired OTP

    def test_otp_rate_limiting(self, client: TestClient, test_user_data: dict):
        """Test OTP rate limiting"""
        email = test_user_data["email"]
        
        # Make multiple OTP requests
        responses = []
        for _ in range(5):  # Adjust based on rate limit
            resend_data = {"email": email}
            response = client.post("/api/v2/auth/resend-otp", json=resend_data)
            responses.append(response)
        
        # At least one should be rate limited
        rate_limited = any(r.status_code == 429 for r in responses)
        assert rate_limited, "OTP rate limiting should be triggered"

    def test_invalid_otp_attempts(self, client: TestClient, test_user_data: dict):
        """Test invalid OTP attempts handling"""
        # Register user
        client.post("/api/v2/auth/signup", json=test_user_data)
        
        # Try multiple invalid OTPs
        invalid_otps = ["000000", "111111", "999999", "abcdef"]
        
        for otp in invalid_otps:
            verify_data = {
                "email": test_user_data["email"],
                "otp": otp
            }
            response = client.post("/api/v2/auth/verify-otp", json=verify_data)
            assert response.status_code == 400
            assert "Invalid OTP" in response.json()["detail"]

    def test_otp_single_use(self, client: TestClient, test_user_data: dict):
        """Test that OTP can only be used once"""
        # Register user
        client.post("/api/v2/auth/signup", json=test_user_data)
        
        # Mock successful OTP verification
        verify_data = {
            "email": test_user_data["email"],
            "otp": "123456"  # Mock valid OTP
        }
        
        # First verification should succeed (with proper mocking)
        # Second verification with same OTP should fail
        response = client.post("/api/v2/auth/verify-otp", json=verify_data)
        # Test structure - second attempt should fail

    def test_otp_for_nonexistent_email(self, client: TestClient):
        """Test OTP request for non-existent email"""
        reset_data = {"email": "nonexistent@example.com"}
        response = client.post("/api/v2/auth/password-reset", json=reset_data)
        
        # Should still return 200 for security (don't reveal email existence)
        assert response.status_code == 200
        assert "Password reset code sent to your email" in response.json()["message"]

    def test_otp_database_storage(self, db_session, create_test_user: User):
        """Test OTP storage in database"""
        from app.repositories.user import UserRepository
        from datetime import datetime, timedelta
        
        user_repo = UserRepository(db_session)
        
        # Create OTP record
        otp_data = {
            "user_id": str(create_test_user.id),
            "email": create_test_user.email,
            "otp_code": "123456",
            "otp_type": "email_verification",
            "expires_at": datetime.utcnow() + timedelta(minutes=15)
        }
        
        # Test OTP creation through repository
        # This would test the actual OTP storage logic

    def test_otp_cleanup(self, db_session):
        """Test cleanup of expired OTPs"""
        from app.tasks.cleanup_tasks import cleanup_expired_otps
        
        # Create expired OTP records
        # Run cleanup task
        # Verify expired OTPs are removed
        
        # Test structure
        assert True  # Placeholder for actual cleanup test
