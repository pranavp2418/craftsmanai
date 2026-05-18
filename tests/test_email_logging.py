import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import override_get_db
from app.models.email_log import EmailLog, EmailStatus
from app.services.email_service import EmailService

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
