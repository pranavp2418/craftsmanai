"""
Email-related background tasks using Celery
All email sending operations are handled here
"""

from app.services.email_service import EmailService
from app.tasks.base import create_task
import logging

logger = logging.getLogger(__name__)


@create_task(name="send_signup_otp_email", max_retries=3)
def send_signup_otp_email(self, to: str, otp: str, user_name: str):
    """
    Send signup OTP email using Celery
    
    Args:
        to: Recipient email address
        otp: One-time password code
        user_name: Name of the user
    
    Retry Logic:
        - 3 max retries
        - 60s initial delay, exponential backoff
    """
    task_name = "send_signup_otp_email"
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        # Run async email service in sync context
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_signup_otp(to, otp, user_name)
        )
        
        logger.info(f"✅ {task_name} completed successfully for {to}")
        
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to}: {str(exc)}")
        
        # Retry with exponential backoff
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )


@create_task(name="send_password_reset_email", max_retries=3)
def send_password_reset_email(self, to: str, otp: str, user_name: str):
    """
    Send password reset OTP email using Celery
    
    Args:
        to: Recipient email address
        otp: Password reset code
        user_name: Name of the user
    """
    task_name = "send_password_reset_email"
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_password_reset_otp(to, otp, user_name)
        )
        
        logger.info(f"✅ {task_name} completed successfully for {to}")
        
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to}: {str(exc)}")
        
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )


@create_task(name="send_welcome_email", max_retries=3)
def send_welcome_email(self, to: str, user_name: str):
    """
    Send welcome email using Celery
    
    Args:
        to: Recipient email address
        user_name: Name of the user
    """
    task_name = "send_welcome_email"
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_welcome_email(to, user_name)
        )
        
        logger.info(f"✅ {task_name} completed successfully for {to}")
        
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to}: {str(exc)}")
        
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )
