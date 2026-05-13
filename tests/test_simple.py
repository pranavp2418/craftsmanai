import pytest
from app.core.security import get_password_hash, verify_password


class TestSimpleSecurity:
    """Simple security tests that don't require database or Redis"""

    def test_password_hashing(self):
        """Test password hashing is working correctly"""
        password = "TestPass123!"
        hashed = get_password_hash(password)
        
        assert hashed != password
        assert "$" in hashed  # Salt separator should be present
        assert verify_password(password, hashed) is True
        assert verify_password("wrongpassword", hashed) is False

    def test_password_hashing_different_passwords(self):
        """Test that different passwords produce different hashes"""
        password1 = "Password123!"
        password2 = "Password456!"
        
        hashed1 = get_password_hash(password1)
        hashed2 = get_password_hash(password2)
        
        assert hashed1 != hashed2
        assert verify_password(password1, hashed1) is True
        assert verify_password(password2, hashed2) is True

    def test_password_verification_wrong_password(self):
        """Test password verification with wrong password"""
        password = "TestPass123!"
        hashed = get_password_hash(password)
        
        assert verify_password("WrongPassword123!", hashed) is False
        assert verify_password("", hashed) is False
        assert verify_password(password + "extra", hashed) is False


class TestSimpleJWT:
    """Simple JWT tests that don't require database"""

    def test_jwt_token_creation_and_validation(self):
        """Test JWT token creation and validation"""
        from app.core.security import create_access_token, decode_access_token
        
        data = {"sub": "123", "email": "test@example.com"}
        token = create_access_token(data)
        
        assert isinstance(token, str)
        assert len(token) > 0
        
        # Test token decoding
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "123"
        assert payload["email"] == "test@example.com"

    def test_refresh_token_creation(self):
        """Test refresh token creation"""
        from app.core.security import create_refresh_token
        
        user_id = "123"
        token, token_id, expires_at = create_refresh_token(user_id, False)
        
        assert isinstance(token, str)
        assert isinstance(token_id, str)
        assert expires_at is not None
        assert len(token) > 0


if __name__ == "__main__":
    # Run tests directly
    test = TestSimpleSecurity()
    test.test_password_hashing()
    test.test_password_hashing_different_passwords()
    test.test_password_verification_wrong_password()
    
    jwt_test = TestSimpleJWT()
    jwt_test.test_jwt_token_creation_and_validation()
    jwt_test.test_refresh_token_creation()
    
    print("✅ All simple tests passed!")
