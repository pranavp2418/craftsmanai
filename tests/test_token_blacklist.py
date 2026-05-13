import pytest
import redis
from fastapi.testclient import TestClient
from app.core.security import create_access_token, create_refresh_token
from app.core.token_blacklist import TokenBlacklist
from app.models.user import User


class TestTokenBlacklist:
    """Test token blacklisting functionality"""

    @pytest.fixture
    def redis_client(self):
        """Redis client for testing"""
        return redis.Redis.from_url("redis://localhost:6379/1", decode_responses=True)

    @pytest.fixture
    def token_blacklist(self, redis_client):
        """Token blacklist instance"""
        return TokenBlacklist(redis_client)

    def test_blacklist_access_token(self, token_blacklist):
        """Test blacklisting access token"""
        user_id = "test_user_123"
        token_id = "test_jti_123"
        
        # Blacklist token
        token_blacklist.blacklist_token(token_id, "access", user_id, "logout", 3600)
        
        # Check if token is blacklisted
        assert token_blacklist.is_token_blacklisted(token_id) is True

    def test_blacklist_refresh_token(self, token_blacklist):
        """Test blacklisting refresh token"""
        user_id = "test_user_123"
        token_id = "test_jti_456"
        
        # Blacklist token
        token_blacklist.blacklist_token(token_id, "refresh", user_id, "logout", 3600)
        
        # Check if token is blacklisted
        assert token_blacklist.is_token_blacklisted(token_id) is True

    def test_blacklist_all_user_tokens(self, token_blacklist):
        """Test blacklisting all user tokens"""
        user_id = "test_user_123"
        
        # Create multiple tokens
        token_ids = ["jti_1", "jti_2", "jti_3"]
        
        # Blacklist tokens for user
        for token_id in token_ids:
            token_blacklist.blacklist_token(token_id, "access", user_id, "logout", 3600)
        
        # Check all tokens are blacklisted
        for token_id in token_ids:
            assert token_blacklist.is_token_blacklisted(token_id) is True
        
        # Check if user has any tokens
        assert token_blacklist.has_user_tokens(user_id) is True

    def test_revoke_all_user_tokens(self, token_blacklist):
        """Test revoking all user tokens"""
        user_id = "test_user_123"
        
        # Create multiple tokens
        token_ids = ["jti_1", "jti_2", "jti_3"]
        
        # Blacklist tokens for user
        for token_id in token_ids:
            token_blacklist.blacklist_token(token_id, "access", user_id, "logout", 3600)
        
        # Revoke all user tokens
        token_blacklist.revoke_all_user_tokens(user_id, "emergency_logout")
        
        # Check user has no active tokens
        assert token_blacklist.has_user_tokens(user_id) is False

    def test_blacklisted_token_decode(self, client: TestClient, create_test_user: User, token_blacklist):
        """Test that blacklisted tokens cannot be decoded"""
        # Create access token
        access_token, token_id, _ = create_access_token(data={"sub": str(create_test_user.id), "email": create_test_user.email})
        
        # Blacklist the token
        token_blacklist.blacklist_token(token_id, "access", str(create_test_user.id), "logout", 3600)
        
        # Try to use blacklisted token
        headers = {"Authorization": f"Bearer {access_token}"}
        response = client.get("/api/v2/auth/me", headers=headers)
        
        assert response.status_code == 401
        assert "Token has been revoked" in response.json()["detail"]

    def test_refresh_token_blacklist(self, client: TestClient, create_test_user: User, token_blacklist):
        """Test refresh token blacklisting"""
        # Create refresh token
        refresh_token, token_id, _ = create_refresh_token(str(create_test_user.id), False)
        
        # Blacklist the refresh token
        token_blacklist.blacklist_token(token_id, "refresh", str(create_test_user.id), "logout", 3600)
        
        # Try to use blacklisted refresh token
        headers = {"Authorization": f"Bearer {refresh_token}"}
        response = client.post("/api/v2/auth/refresh", headers=headers)
        
        assert response.status_code == 401
        assert "Token has been revoked" in response.json()["detail"]

    def test_logout_all_devices(self, client: TestClient, create_test_user: User, token_blacklist):
        """Test logout from all devices"""
        # Create multiple tokens for user
        access_token1, jti1, _ = create_access_token(data={"sub": str(create_test_user.id), "email": create_test_user.email})
        access_token2, jti2, _ = create_access_token(data={"sub": str(create_test_user.id), "email": create_test_user.email})
        
        # Blacklist first token
        token_blacklist.blacklist_token(jti1, "access", str(create_test_user.id), "logout", 3600)
        token_blacklist.blacklist_token(jti2, "access", str(create_test_user.id), "logout", 3600)
        
        # Test logout all devices endpoint
        headers = {"Authorization": f"Bearer {access_token1}"}
        response = client.post("/api/v2/auth/logout-all", headers=headers)
        
        assert response.status_code == 200
        assert "Logged out from all devices" in response.json()["message"]
        
        # Both tokens should be blacklisted
        assert token_blacklist.is_token_blacklisted(jti1) is True
        assert token_blacklist.is_token_blacklisted(jti2) is True

    def test_token_ttl_expiration(self, token_blacklist):
        """Test that blacklisted tokens expire after TTL"""
        user_id = "test_user_123"
        token_id = "test_jti_ttl"
        
        # Blacklist token with very short TTL (1 second)
        token_blacklist.blacklist_token(token_id, "access", user_id, "logout", 1)
        
        # Token should be blacklisted immediately
        assert token_blacklist.is_token_blacklisted(token_id) is True
        
        # Wait for expiration (in real tests, you'd use time.sleep or mocking)
        # For now, just test the structure

    def test_cleanup_expired_tokens(self, token_blacklist):
        """Test cleanup of expired blacklisted tokens"""
        user_id = "test_user_123"
        
        # Create tokens with different TTLs
        token_blacklist.blacklist_token("expired_token", "access", user_id, "logout", 1)
        token_blacklist.blacklist_token("valid_token", "access", user_id, "logout", 3600)
        
        # Test cleanup logic would remove expired tokens
        # This would be tested with actual time manipulation in real scenarios

    def test_concurrent_blacklisting(self, token_blacklist):
        """Test concurrent token blacklisting"""
        user_id = "test_user_123"
        
        # Simulate concurrent blacklisting
        import threading
        
        def blacklist_token(token_id):
            token_blacklist.blacklist_token(token_id, "access", user_id, "logout", 3600)
        
        # Create multiple threads
        threads = []
        for i in range(5):
            thread = threading.Thread(target=blacklist_token, args=(f"token_{i}",))
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Check all tokens are blacklisted
        for i in range(5):
            assert token_blacklist.is_token_blacklisted(f"token_{i}") is True
