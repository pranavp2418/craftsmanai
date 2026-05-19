import pytest
from unittest.mock import patch, MagicMock
from app.tasks.email_tasks import (
    send_signup_otp_email,
    send_password_reset_email,
    send_welcome_email
)
from app.tasks.cleanup_tasks import (
    cleanup_expired_otps,
    cleanup_expired_tokens,
    cleanup_blacklisted_tokens
)


class TestCeleryTasks:
    """Test Celery background tasks"""

    @patch('app.tasks.email_tasks.EmailService')
    def test_send_signup_otp_email_task(self, mock_email_service):
        """Test signup OTP email task"""
        # Setup mock
        from unittest.mock import AsyncMock
        mock_email_service.send_signup_otp = AsyncMock(return_value=True)
        
        # Test task execution
        result = send_signup_otp_email("test@example.com", "123456", "Test User")
        
        # Verify task completed
        assert result is True
        
        # Verify email service was called
        mock_email_service.send_signup_otp.assert_called_once_with(
            "test@example.com", "123456", "Test User"
        )

    @patch('app.tasks.email_tasks.EmailService')
    def test_send_password_reset_email_task(self, mock_email_service):
        """Test password reset email task"""
        # Setup mock
        from unittest.mock import AsyncMock
        mock_email_service.send_password_reset_otp = AsyncMock(return_value=True)
        
        # Test task execution
        result = send_password_reset_email("test@example.com", "123456", "Test User")
        
        # Verify task completed
        assert result is True
        
        # Verify email service was called
        mock_email_service.send_password_reset_otp.assert_called_once_with(
            "test@example.com", "123456", "Test User"
        )

    @patch('app.tasks.email_tasks.EmailService')
    def test_send_welcome_email_task(self, mock_email_service):
        """Test welcome email task"""
        # Setup mock
        from unittest.mock import AsyncMock
        mock_email_service.send_welcome_email = AsyncMock(return_value=True)
        
        # Test task execution
        result = send_welcome_email("test@example.com", "Test User")
        
        # Verify task completed
        assert result is True
        
        # Verify email service was called
        mock_email_service.send_welcome_email.assert_called_once_with(
            "test@example.com", "Test User"
        )

    @patch('app.tasks.email_tasks.logger')
    @patch('app.tasks.email_tasks.EmailService')
    def test_email_task_retry_logic(self, mock_email_service, mock_logger):
        """Test email task retry logic on failure"""
        # Setup mock to raise exception
        mock_email_service.send_signup_otp.side_effect = Exception("SMTP Error")
        
        # Test task execution with retry
        with pytest.raises(Exception):
            send_signup_otp_email("test@example.com", "123456", "Test User")
        
        # Verify retry logging
        mock_logger.error.assert_called()

    @patch('app.core.database.SessionLocal')
    def test_cleanup_expired_otps_task(self, mock_session_local, db_session, create_test_user):
        """Test cleanup expired OTPs task"""
        mock_session = MagicMock(wraps=db_session)
        mock_session.close = MagicMock()
        mock_session_local.return_value = mock_session
        user = create_test_user()
        
        # Create test OTP records
        from app.models.otp import OTP
        from datetime import datetime, timezone, timedelta
        
        # Create expired OTP
        expired_otp = OTP(
            user_id=user.id,
            email="test@example.com",
            otp_code="123456",
            otp_type="email_verification",
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)  # Expired
        )
        db_session.add(expired_otp)
        
        # Create valid OTP
        valid_otp = OTP(
            user_id=user.id,
            email="test2@example.com",
            otp_code="654321",
            otp_type="email_verification",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)  # Valid
        )
        db_session.add(valid_otp)
        db_session.commit()
        
        # Run cleanup task
        result = cleanup_expired_otps()
        
        # Verify task completed
        assert result is True
        
        # Verify expired OTP was removed
        remaining_otps = db_session.query(OTP).filter(OTP.user_id == user.id).all()
        assert len(remaining_otps) == 1
        assert remaining_otps[0].otp_code == "654321"

    @patch('app.core.database.SessionLocal')
    def test_cleanup_expired_refresh_tokens_task(self, mock_session_local, db_session, create_test_user):
        """Test cleanup expired refresh tokens task"""
        mock_session = MagicMock(wraps=db_session)
        mock_session.close = MagicMock()
        mock_session_local.return_value = mock_session
        user = create_test_user()
        
        from app.models.refresh_token import RefreshToken
        from datetime import datetime, timezone, timedelta
        
        # Create expired refresh token
        expired_token = RefreshToken(
            user_id=user.id,
            token_id="expired_token",
            hashed_token="hashed_token",
            device_id="device1",
            expires_at=datetime.now(timezone.utc) - timedelta(days=1)  # Expired
        )
        db_session.add(expired_token)
        
        # Create valid refresh token
        valid_token = RefreshToken(
            user_id=user.id,
            token_id="valid_token",
            hashed_token="hashed_token2",
            device_id="device2",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7)  # Valid
        )
        db_session.add(valid_token)
        db_session.commit()
        
        # Run cleanup task
        result = cleanup_expired_tokens()
        
        # Verify task completed
        assert result is True
        
        # Verify expired token was removed
        remaining_tokens = db_session.query(RefreshToken).filter(RefreshToken.user_id == user.id).all()
        assert len(remaining_tokens) == 1
        assert remaining_tokens[0].token_id == "valid_token"

    @patch('app.core.database.SessionLocal')
    def test_cleanup_blacklisted_tokens_task(self, mock_session_local, db_session, create_test_user):
        """Test cleanup blacklisted tokens task"""
        mock_session = MagicMock(wraps=db_session)
        mock_session.close = MagicMock()
        mock_session_local.return_value = mock_session
        user = create_test_user()
        
        from app.models.blacklisted_token import BlacklistedToken
        from datetime import datetime, timezone, timedelta
        
        # Create expired blacklisted token
        expired_blacklist = BlacklistedToken(
            jti="expired_jti",
            token_type="access",
            user_id=user.id,
            reason="logout",
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)  # Expired
        )
        db_session.add(expired_blacklist)
        
        # Create valid blacklisted token
        valid_blacklist = BlacklistedToken(
            jti="valid_jti",
            token_type="access",
            user_id=user.id,
            reason="logout",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)  # Valid
        )
        db_session.add(valid_blacklist)
        db_session.commit()
        
        # Run cleanup task
        result = cleanup_blacklisted_tokens()
        
        # Verify task completed
        assert result is True
        
        # Verify expired blacklist was removed
        remaining_blacklists = db_session.query(BlacklistedToken).filter(BlacklistedToken.user_id == user.id).all()
        assert len(remaining_blacklists) == 1
        assert remaining_blacklists[0].jti == "valid_jti"

    @patch('app.tasks.email_tasks.EmailService')
    @patch('app.tasks.email_tasks.logger')
    def test_task_error_handling(self, mock_logger, mock_email_service):
        """Test task error handling and logging"""
        # Mock EmailService to raise exception
        mock_email_service.send_signup_otp.side_effect = Exception("SMTP Error")
        
        # Test task execution
        with pytest.raises(Exception):
            send_signup_otp_email("test@example.com", "123456", "Test User")
        
        # Verify error logging
        mock_logger.error.assert_called()

    def test_task_priority_routing(self):
        """Test task priority and queue routing"""
        from app.tasks.config import CELERY_ROUTES, CELERY_TASK_PRIORITIES
        
        # Verify email tasks are routed to email queue
        assert "app.tasks.email_tasks.send_signup_otp_email" in CELERY_ROUTES
        assert CELERY_ROUTES["app.tasks.email_tasks.send_signup_otp_email"] == {"queue": "email"}
        
        # Verify queue priorities
        assert CELERY_TASK_PRIORITIES["email"] == 8
        assert CELERY_TASK_PRIORITIES["cleanup"] == 3

    def test_task_scheduling(self):
        """Test periodic task scheduling"""
        from app.tasks.config import SCHEDULE_CONFIG
        
        # Verify cleanup tasks are scheduled
        assert "cleanup_otps" in SCHEDULE_CONFIG
        assert "cleanup_tokens" in SCHEDULE_CONFIG
        assert "cleanup_blacklist" in SCHEDULE_CONFIG
        
        # Verify schedule is periodic
        cleanup_schedule = SCHEDULE_CONFIG["cleanup_otps"]
        assert "schedule" in cleanup_schedule

    @patch('app.tasks.email_tasks.send_signup_otp_email.retry')
    def test_task_retry_configuration(self, mock_retry):
        """Test task retry configuration"""
        from app.tasks.base import create_task
        
        # Test that tasks have proper retry configuration
        @create_task("test_task", max_retries=3)
        def dummy_task(self):
            pass
            
        assert dummy_task.max_retries == 3

    @patch('app.core.database.SessionLocal')
    def test_task_idempotency(self, mock_session_local, db_session):
        """Test task idempotency"""
        mock_session = MagicMock(wraps=db_session)
        mock_session.close = MagicMock()
        mock_session_local.return_value = mock_session
        # Test that running the same cleanup task multiple times
        # doesn't cause issues
        result1 = cleanup_expired_otps()
        result2 = cleanup_expired_otps()
        
        # Both should succeed
        assert result1 is True
        assert result2 is True
