import pytest
import asyncio
from fastapi.testclient import TestClient
from app.core.security import create_access_token, create_refresh_token
from app.core.token_blacklist import TokenBlacklist
from app.models.user import User


class TestSecurityIntegration:
    """Test security features integration"""

    def test_complete_auth_flow_with_tokens(self, client: TestClient, test_user_data: dict):
        """Test complete authentication flow with token management"""
        # Step 1: Register user
        response = client.post("/api/v2/auth/signup", json=test_user_data)
        assert response.status_code == 201
        
        # Step 2: Login to get tokens
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"],
            "remember_me": False
        }
        response = client.post("/api/v2/auth/login", json=login_data)
        assert response.status_code == 200
        
        login_response = response.json()
        access_token = login_response["access_token"]
        
        # Step 3: Use access token to get user info
        headers = {"Authorization": f"Bearer {access_token}"}
        response = client.get("/api/v2/auth/me", headers=headers)
        assert response.status_code == 200
        assert response.json()["email"] == test_user_data["email"]
        
        # Step 4: Logout (blacklist tokens)
        response = client.post("/api/v2/auth/logout", headers=headers)
        assert response.status_code == 200
        
        # Step 5: Try to use blacklisted token
        response = client.get("/api/v2/auth/me", headers=headers)
        assert response.status_code == 401

    def test_token_refresh_flow(self, client: TestClient, create_test_user: User):
        """Test token refresh flow with blacklisting"""
        # Create initial tokens
        access_token, access_jti, _ = create_access_token(
            data={"sub": str(create_test_user.id), "email": create_test_user.email}
        )
        refresh_token, refresh_jti, _ = create_refresh_token(str(create_test_user.id), False)
        
        # Use refresh token to get new access token
        headers = {"Authorization": f"Bearer {refresh_token}"}
        response = client.post("/api/v2/auth/refresh", headers=headers)
        
        assert response.status_code == 200
        new_access_token = response.json()["access_token"]
        
        # New token should be different
        assert new_access_token != access_token
        
        # New token should work
        new_headers = {"Authorization": f"Bearer {new_access_token}"}
        response = client.get("/api/v2/auth/me", headers=new_headers)
        assert response.status_code == 200

    def test_concurrent_token_usage(self, client: TestClient, create_test_user: User):
        """Test concurrent token usage and blacklisting"""
        # Create multiple access tokens
        tokens = []
        for i in range(3):
            token, jti, _ = create_access_token(
                data={"sub": str(create_test_user.id), "email": create_test_user.email}
            )
            tokens.append((token, jti))
        
        # All tokens should work initially
        for token, _ in tokens:
            headers = {"Authorization": f"Bearer {token}"}
            response = client.get("/api/v2/auth/me", headers=headers)
            assert response.status_code == 200
        
        # Blacklist one token
        headers = {"Authorization": f"Bearer {tokens[0][0]}"}
        response = client.post("/api/v2/auth/logout", headers=headers)
        assert response.status_code == 200
        
        # Blacklisted token should fail
        response = client.get("/api/v2/auth/me", headers=headers)
        assert response.status_code == 401
        
        # Other tokens should still work
        for token, _ in tokens[1:]:
            headers = {"Authorization": f"Bearer {token}"}
            response = client.get("/api/v2/auth/me", headers=headers)
            assert response.status_code == 200

    def test_device_limit_enforcement(self, client: TestClient, create_test_user: User):
        """Test device limit enforcement"""
        # Create tokens for multiple devices
        device_tokens = []
        for i in range(6):  # Exceeds MAX_ACTIVE_DEVICES (5)
            token, jti, _ = create_access_token(
                data={"sub": str(create_test_user.id), "email": create_test_user.email}
            )
            device_tokens.append(token)
        
        # Test device management endpoint
        access_token = device_tokens[0]
        headers = {"Authorization": f"Bearer {access_token}"}
        
        response = client.get("/api/v2/auth/devices", headers=headers)
        assert response.status_code == 200
        devices = response.json()
        
        # Should have device limit enforced
        assert len(devices) <= 5

    def test_security_headers(self, client: TestClient):
        """Test security headers are present"""
        response = client.get("/api/v2/endpoints/health")
        
        # Check for security headers
        headers = response.headers
        
        # These should be present based on your security configuration
        assert "x-content-type-options" in headers
        assert "x-frame-options" in headers
        assert "referrer-policy" in headers

    def test_rate_limiting_endpoints(self, client: TestClient):
        """Test rate limiting on various endpoints"""
        # Test login endpoint rate limiting
        login_data = {
            "email": "test@example.com",
            "password": "wrongpassword",
            "remember_me": False
        }
        
        responses = []
        for _ in range(10):  # Make many requests
            response = client.post("/api/v2/auth/login", json=login_data)
            responses.append(response)
        
        # Should hit rate limit
        rate_limited = any(r.status_code == 429 for r in responses)
        assert rate_limited, "Login rate limiting should be triggered"

    def test_input_validation_security(self, client: TestClient):
        """Test input validation prevents injection attacks"""
        # Test SQL injection attempts
        malicious_inputs = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "<script>alert('xss')</script>",
            "../../etc/passwd"
        ]
        
        for malicious_input in malicious_inputs:
            # Test in registration
            malicious_user = {
                "email": f"{malicious_input}@example.com",
                "username": malicious_input,
                "full_name": malicious_input,
                "password": "ValidPassword123!"
            }
            
            response = client.post("/api/v2/auth/signup", json=malicious_user)
            # Should either be rejected by validation or handled safely
            assert response.status_code in [400, 422, 201]

    def test_cors_configuration(self, client: TestClient):
        """Test CORS configuration"""
        # Test preflight request
        response = client.options(
            "/api/v2/auth/login",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        
        # Should have proper CORS headers
        assert "access-control-allow-origin" in response.headers

    def test_error_message_sanitization(self, client: TestClient):
        """Test that error messages don't leak sensitive information"""
        # Test with invalid database connection (simulated)
        response = client.post("/api/v2/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword",
            "remember_me": False
        })
        
        assert response.status_code == 401
        error_detail = response.json()["detail"]
        
        # Should not contain database errors, stack traces, etc.
        assert "database" not in error_detail.lower()
        assert "sql" not in error_detail.lower()
        assert "traceback" not in error_detail.lower()

    def test_session_management(self, client: TestClient, create_test_user: User):
        """Test proper session management"""
        # Create access token
        access_token, jti, _ = create_access_token(
            data={"sub": str(create_test_user.id), "email": create_test_user.email}
        )
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Make multiple requests with same token
        for _ in range(5):
            response = client.get("/api/v2/auth/me", headers=headers)
            assert response.status_code == 200
        
        # Token should still be valid
        response = client.get("/api/v2/auth/me", headers=headers)
        assert response.status_code == 200

    def test_password_security(self, client: TestClient, create_test_user: User):
        """Test password security measures"""
        # Test password change with strong validation
        access_token = create_access_token(
            data={"sub": str(create_test_user.id), "email": create_test_user.email}
        )
        
        headers = {"Authorization": f"Bearer {access_token}"}
        
        # Test weak password rejection
        weak_passwords = [
            "123",
            "password",
            "weak",
            "11111111",
            "password123"
        ]
        
        for weak_password in weak_passwords:
            password_data = {
                "current_password": "TestPassword123!",
                "new_password": weak_password
            }
            
            response = client.post("/api/v2/auth/change-password", 
                                 json=password_data, headers=headers)
            assert response.status_code == 422

    def test_token_structure_validation(self, client: TestClient):
        """Test token structure and validation"""
        # Test malformed tokens
        malformed_tokens = [
            "invalid.token",
            "bearer invalid",
            "",
            "null",
            "undefined",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"
        ]
        
        for token in malformed_tokens:
            headers = {"Authorization": f"Bearer {token}"}
            response = client.get("/api/v2/auth/me", headers=headers)
            assert response.status_code == 401

    def test_concurrent_requests_safety(self, client: TestClient, create_test_user: User):
        """Test concurrent requests safety"""
        import threading
        import time
        
        # Create access token
        access_token, jti, _ = create_access_token(
            data={"sub": str(create_test_user.id), "email": create_test_user.email}
        )
        
        results = []
        
        def make_request():
            headers = {"Authorization": f"Bearer {access_token}"}
            response = client.get("/api/v2/auth/me", headers=headers)
            results.append(response.status_code)
        
        # Create multiple threads
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All requests should succeed
        assert all(status == 200 for status in results)
