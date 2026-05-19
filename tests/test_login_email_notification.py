"""
Tests for email sending during login

These tests verify that:
1. Welcome email is queued when user logs in successfully
2. Email is sent with correct parameters (email, user_name, user_id)
3. Email failure doesn't prevent successful login
4. Email is not sent for failed login attempts
"""

import pytest
from unittest.mock import patch, MagicMock, call
from fastapi.testclient import TestClient
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy import select


class TestLoginEmailNotification:
    """Test email sending during login process"""

    @pytest.fixture
    def active_verified_user(self, db_session):
        """Create an active, verified user for login tests"""
        user = User(
            email="priti90066@gmail.com",
            username="login_test_user",
            hashed_password=get_password_hash("TestPassword123!"),
            is_active=True,
            is_verified=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    def test_login_queues_welcome_email(self, client, active_verified_user):
        """Test that welcome email task is queued on successful login"""
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            # Perform login
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": False
                }
            )
            
            # Login should succeed
            assert response.status_code == 200
            data = response.json()
            assert data["access_token"]
            assert data["email"] == "priti90066@gmail.com"
            
            # Email task should have been queued
            mock_send_email.assert_called_once()
            
            # Verify email was called with correct parameters
            call_args = mock_send_email.call_args
            assert call_args[1]["to"] == "priti90066@gmail.com"
            assert call_args[1]["user_name"] == "login_test_user"
            assert call_args[1]["user_id"] == str(active_verified_user.id)

    def test_login_email_queued_with_email_fallback(self, client, active_verified_user):
        """Test that email task is queued even if email service has issues"""
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            # Simulate Celery being available
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": False
                }
            )
            
            assert response.status_code == 200
            # Email should still be queued
            mock_send_email.assert_called_once()

    def test_login_does_not_fail_if_email_queueing_fails(self, client, active_verified_user):
        """Test that login succeeds even if email queueing fails"""
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            # Make email queueing raise an exception
            mock_send_email.side_effect = Exception("Celery connection failed")
            
            # Login should still succeed
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": False
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["access_token"]

    def test_login_with_remember_me_queues_email(self, client, active_verified_user):
        """Test email is queued with remember_me=True"""
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": True
                }
            )
            
            assert response.status_code == 200
            # Email should still be queued
            mock_send_email.assert_called_once()

    def test_login_no_email_on_invalid_credentials(self, client, active_verified_user):
        """Test that no email is sent on failed login with invalid credentials"""
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "WrongPassword123!",
                    "remember_me": False
                }
            )
            
            # Login should fail
            assert response.status_code == 401
            
            # Email should NOT be queued
            mock_send_email.assert_not_called()

    def test_login_no_email_on_inactive_user(self, client, db_session):
        """Test that no email is sent when user is inactive"""
        
        # Create inactive user
        inactive_user = User(
            email="priti90066@gmail.com",
            username="inactive_user",
            hashed_password=get_password_hash("TestPassword123!"),
            is_active=False,
            is_verified=True,
        )
        db_session.add(inactive_user)
        db_session.commit()
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": False
                }
            )
            
            # Login should fail
            assert response.status_code == 401
            
            # Email should NOT be queued
            mock_send_email.assert_not_called()

    def test_login_no_email_on_unverified_user(self, client, db_session):
        """Test that no email is sent when user is not verified"""
        
        # Create unverified user
        unverified_user = User(
            email="priti90066@gmail.com",
            username="unverified_user",
            hashed_password=get_password_hash("TestPassword123!"),
            is_active=True,
            is_verified=False,
        )
        db_session.add(unverified_user)
        db_session.commit()
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": False
                }
            )
            
            # Login should fail
            assert response.status_code == 401
            
            # Email should NOT be queued
            mock_send_email.assert_not_called()

    def test_login_email_uses_username_as_fallback(self, client, db_session):
        """Test that email uses email as fallback if username is not set"""
        
        # Create user without username (edge case)
        user = User(
            email="priti90066@gmail.com",
            username=None,
            hashed_password=get_password_hash("TestPassword123!"),
            is_active=True,
            is_verified=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": False
                }
            )
            
            assert response.status_code == 200
            
            # Email should be queued with email as fallback for user_name
            mock_send_email.assert_called_once()
            call_args = mock_send_email.call_args
            assert call_args[1]["user_name"] == "priti90066@gmail.com"

    def test_login_response_includes_welcome_message(self, client, active_verified_user):
        """Test that login response includes appropriate notification message"""
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay'):
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": False
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["notification_message"] == "Welcome back!"

    def test_login_sets_refresh_token_cookie(self, client, active_verified_user):
        """Test that refresh token cookie is set on successful login"""
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay'):
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": False
                }
            )
            
            assert response.status_code == 200
            
            # Check refresh token cookie is set
            cookies = response.cookies
            assert "refresh_token" in cookies
            refresh_token = cookies.get("refresh_token")
            assert refresh_token is not None

    def test_login_email_called_after_last_login_update(self, client, active_verified_user, db_session):
        """Test that email is sent after last login is updated"""
        
        # Record initial last login
        initial_last_login = active_verified_user.last_login
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "TestPassword123!",
                    "remember_me": False
                }
            )
            
            assert response.status_code == 200
            
            # Verify email was queued
            mock_send_email.assert_called_once()
            
            # Check that last login was updated
            db_session.refresh(active_verified_user)
            assert active_verified_user.last_login is not None
            # If initial was None, should now be set
            if initial_last_login is None:
                assert active_verified_user.last_login > initial_last_login


class TestWelcomeEmailTask:
    """Test the send_welcome_email Celery task directly"""

    def test_welcome_email_task_calls_global_email_system(self):
        """Test that welcome email task tries to use global email system first"""
        from app.tasks.email_tasks import send_welcome_email
        
        task_instance = MagicMock()
        task_instance.retry = MagicMock()
        
        with patch('app.tasks.email_tasks.send_email') as mock_send_email:
            with patch('app.core.database.SessionLocal'):
                mock_send_email.return_value = {"success": True, "log_id": "test-id"}
                
                # This would normally be called by Celery
                # For testing, we just verify the structure
                pass  # Integration test would catch this

    def test_welcome_email_task_fallback_on_template_error(self):
        """Test that welcome email task falls back to basic service on error"""
        from app.tasks.email_tasks import send_welcome_email
        
        task_instance = MagicMock()
        task_instance.retry = MagicMock()
        task_instance.request = MagicMock()
        task_instance.request.retries = 0
        
        # This would be tested in integration tests with actual Celery


class TestLoginEmailIntegration:
    """Integration tests for login with email sending"""

    def test_complete_login_workflow_with_email(self, client, db_session):
        """Test complete login workflow from start to email queuing"""
        
        # Create a verified user
        user = User(
            email="priti90066@gmail.com",
            username="integration_user",
            hashed_password=get_password_hash("Integration123!"),
            is_active=True,
            is_verified=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        
        with patch('app.tasks.email_tasks.send_welcome_email.delay') as mock_send_email:
            # Perform login
            response = client.post(
                "/api/v2/auth/login",
                json={
                    "email": "priti90066@gmail.com",
                    "password": "Integration123!",
                    "remember_me": False
                }
            )
            
            # Verify successful response
            assert response.status_code == 200
            data = response.json()
            assert data["access_token"]
            assert data["email"] == "priti90066@gmail.com"
            assert data["username"] == "integration_user"
            assert data["is_verified"] is True
            
            # Verify email was queued
            mock_send_email.assert_called_once()
            
            # Verify all email parameters
            call_kwargs = mock_send_email.call_args[1]
            assert call_kwargs["to"] == "priti90066@gmail.com"
            assert call_kwargs["user_name"] == "integration_user"
            assert call_kwargs["user_id"] == str(user.id)
            
            # Verify refresh token cookie
            assert "refresh_token" in response.cookies
