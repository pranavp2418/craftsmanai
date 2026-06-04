import smtplib
import uuid

import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import override_get_db
from app.models.email_log import EmailLog, EmailStatus
from app.services.email_service import EmailService
from app.tasks.email_tasks import send_design_review_email

@pytest.fixture
def anyio_backend():
    return 'asyncio'

class TestEmailLogging:
    """Test EmailLog creation and status updates during email sending"""

    @patch('smtplib.SMTP')
    @pytest.mark.anyio
    async def test_send_signup_otp_logs_success(self, mock_smtp):
        """Test that send_signup_otp creates a SENT log in database on success"""
        # Mock SMTP connection and methods
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server

        to_email = "log_test_success@example.com"
        otp_code = "123456"
        user_name = "Log Test User"

        # Execute email service method
        await EmailService.send_signup_otp(to_email, otp_code, user_name)

        # Retrieve log from database using override_get_db
        db = next(override_get_db())
        try:
            log_record = db.query(EmailLog).filter(
                EmailLog.to_email == to_email,
                EmailLog.template_name == "signup_otp"
            ).order_by(EmailLog.created_at.desc()).first()

            assert log_record is not None, "EmailLog record was not created"
            assert log_record.status == EmailStatus.SENT
            assert log_record.subject == "Verify your email address - Craftmen"
            assert "123456" in log_record.template_variables
            assert "Log Test User" in log_record.template_variables
            assert log_record.sent_at is not None
            assert log_record.error_message is None
        finally:
            db.close()

    @patch('smtplib.SMTP')
    @pytest.mark.anyio
    async def test_send_signup_otp_logs_failure(self, mock_smtp):
        """Test that send_signup_otp creates a FAILED log in database with error message on SMTP failure"""
        # Mock SMTP to raise an exception
        mock_smtp.side_effect = Exception("SMTP Connection Timeout")

        to_email = "log_test_failure@example.com"
        otp_code = "654321"
        user_name = "Log Fail User"

        # Execute email service method, expecting it to raise the exception
        with pytest.raises(Exception) as excinfo:
            await EmailService.send_signup_otp(to_email, otp_code, user_name)
        
        assert "SMTP Connection Timeout" in str(excinfo.value)

        # Retrieve log from database
        db = next(override_get_db())
        try:
            log_record = db.query(EmailLog).filter(
                EmailLog.to_email == to_email,
                EmailLog.template_name == "signup_otp"
            ).order_by(EmailLog.created_at.desc()).first()

            assert log_record is not None, "EmailLog record was not created"
            assert log_record.status == EmailStatus.FAILED
            assert "SMTP Connection Timeout" in log_record.error_message
            assert log_record.sent_at is None
        finally:
            db.close()

    @patch("app.tasks.email_tasks.send_design_review_email.retry")
    @patch("app.tasks.email_tasks.smtplib.SMTP")
    def test_send_design_review_email_logs_retrying_status(self, mock_smtp, mock_retry):
        """Test that design review email logs a retrying status and preserves the log id."""
        mock_server = MagicMock()
        mock_server.login.side_effect = Exception("SMTP Connection Timeout")
        mock_smtp.return_value.__enter__.return_value = mock_server
        mock_retry.side_effect = Exception("Retry queued")

        unique_email = f"design-review-log-{uuid.uuid4().hex}@example.com"

        with pytest.raises(Exception) as excinfo:
            send_design_review_email(
                unique_email,
                "Log Test Customer",
                "http://localhost:3000/customer/review/public-token?token=share-token",
                "Review Ring",
                "Variant A",
            )

        assert "Retry queued" in str(excinfo.value)

        db = next(override_get_db())
        try:
            log_record = db.query(EmailLog).filter(
                EmailLog.to_email == unique_email,
                EmailLog.template_name == "design_review",
            ).order_by(EmailLog.created_at.desc()).first()

            assert log_record is not None, "Design review EmailLog record was not created"
            assert log_record.status == EmailStatus.RETRYING
            assert log_record.retry_count == 1
            assert "SMTP Connection Timeout" in log_record.error_message
            assert "SMTP Connection Timeout" in (log_record.smtp_response or "")
            assert log_record.sent_at is None
        finally:
            db.close()

        assert mock_retry.called
        retry_kwargs = mock_retry.call_args.kwargs["kwargs"]
        assert retry_kwargs["email_log_id"] == str(log_record.id)

    @patch("app.tasks.email_tasks.send_design_review_email.retry")
    @patch("app.tasks.email_tasks.smtplib.SMTP")
    def test_send_design_review_email_marks_auth_failure_without_retry(self, mock_smtp, mock_retry):
        """Test that SMTP authentication errors are logged as failed without retrying."""
        mock_server = MagicMock()
        mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Authentication Failed")
        mock_smtp.return_value.__enter__.return_value = mock_server

        unique_email = f"design-review-auth-{uuid.uuid4().hex}@example.com"

        with pytest.raises(smtplib.SMTPAuthenticationError):
            send_design_review_email(
                unique_email,
                "Auth Test Customer",
                "http://localhost:3000/customer/review/public-token?token=share-token",
                "Review Pendant",
                "Variant B",
            )

        db = next(override_get_db())
        try:
            log_record = db.query(EmailLog).filter(
                EmailLog.to_email == unique_email,
                EmailLog.template_name == "design_review",
            ).order_by(EmailLog.created_at.desc()).first()

            assert log_record is not None, "Design review EmailLog record was not created"
            assert log_record.status == EmailStatus.FAILED
            assert log_record.retry_count == 1
            assert "Authentication Failed" in log_record.error_message
            assert "535" in (log_record.smtp_response or "")
            assert log_record.sent_at is None
        finally:
            db.close()

        mock_retry.assert_not_called()
