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
        return True
        
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
        return True
        
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
        return True
        
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to}: {str(exc)}")
        
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )


@create_task(name="send_customer_share_sms", max_retries=3)
def send_customer_share_sms(self, to_number: str, customer_name: str, preview_url: str, designer_name: str):
    """
    Send an SMS to a customer with a link to review a shared design.
    """
    task_name = "send_customer_share_sms"
    try:
        logger.info(f"📱 Starting {task_name} for {to_number}")
        
        from app.services.sms_service import sms_service
        
        if not sms_service.is_configured():
            logger.warning(f"⚠️ {task_name}: SMS service not configured.")
            return False
            
        message = f"Hi {customer_name}, {designer_name} has shared a design with you! View it here: {preview_url}"
        
        success = sms_service.send_sms(to_number=to_number, message=message)
        
        if success:
            logger.info(f"✅ {task_name} completed successfully for {to_number}")
            return True
        else:
            raise Exception("Failed to send SMS via Twilio.")
            
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to_number}: {str(exc)}")
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )


@create_task(name="send_customer_share_email", max_retries=3)
def send_customer_share_email(self, to_email: str, customer_name: str, preview_url: str, designer_name: str):
    """
    Send an email to a customer with a link to review a shared design.
    """
    task_name = "send_customer_share_email"
    try:
        logger.info(f"📧 Starting {task_name} for {to_email}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_customer_share(to_email, customer_name, preview_url, designer_name)
        )
        
        logger.info(f"✅ {task_name} completed successfully for {to_email}")
        return True
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to_email}: {str(exc)}")
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )


@create_task(name="send_manufacturer_share_email", max_retries=3)
def send_manufacturer_share_email(self, to_email: str, manufacturer_name: str, preview_url: str, designer_name: str):
    """
    Send an email to a manufacturer with a link to review a shared design.
    """
    task_name = "send_manufacturer_share_email"
    try:
        logger.info(f"📧 Starting {task_name} for {to_email}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_manufacturer_share(to_email, manufacturer_name, preview_url, designer_name)
        )
        
        logger.info(f"✅ {task_name} completed successfully for {to_email}")
        return True
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to_email}: {str(exc)}")
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )


@create_task(name="send_team_invitation_email", max_retries=3)
def send_team_invitation_email(self, to_email: str, team_name: str, variables: dict):
    """
    Send team invitation email using Celery
    
    Args:
        to_email: Recipient email address
        team_name: Name of the team
        variables: Email template variables
    
    Retry Logic:
        - 3 max retries
        - 60s initial delay, exponential backoff
    """
    task_name = "send_team_invitation_email"
    
    try:
        logger.info(f"📧 Starting {task_name} for {to_email} to join {team_name}")
        
        from app.core.database import SessionLocal
        from app.models.email_log import EmailLog, EmailStatus
        import json
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from app.core.config import settings
        
        db = SessionLocal()
        
        subject = f"You're invited to join {team_name} on Craftmen"
        
        # Create email log
        email_log = EmailLog(
            to_email=to_email,
            template_name="team_invitation",
            subject=subject,
            template_variables=json.dumps(variables),
            status=EmailStatus.PENDING
        )
        db.add(email_log)
        db.commit()
        db.refresh(email_log)
        log_id = email_log.id
        
        # Build email content
        html_content = _build_team_invitation_html(team_name, variables)
        text_content = _build_team_invitation_text(team_name, variables)
        
        # Send email
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = settings.EMAILS_FROM_EMAIL or settings.SMTP_USER
        msg['To'] = to_email
        
        msg.attach(MIMEText(text_content, 'plain'))
        msg.attach(MIMEText(html_content, 'html'))
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_email], msg.as_string())
        
        # Update log status
        email_log = db.query(EmailLog).filter(EmailLog.id == log_id).first()
        if email_log:
            email_log.status = EmailStatus.SENT
            db.commit()
        
        db.close()
        
        logger.info(f"✅ {task_name} completed successfully for {to_email}")
        return True
        
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to_email}: {str(exc)}")
        
        try:
            if 'log_id' in locals():
                db = SessionLocal()
                email_log = db.query(EmailLog).filter(EmailLog.id == log_id).first()
                if email_log:
                    email_log.status = EmailStatus.FAILED
                    email_log.error_message = str(exc)
                    db.commit()
                db.close()
        except Exception as e:
            logger.error(f"Failed to update email log: {str(e)}")
        
        # Retry with exponential backoff
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )


def _build_team_invitation_html(team_name: str, variables: dict) -> str:
    """Build HTML email content for team invitation"""
    
    invited_name = variables.get('invited_name', 'Team Member')
    invited_by_name = variables.get('invited_by_name', 'Team Admin')
    invitation_link = variables.get('invitation_link', '#')
    role = variables.get('role', 'Viewer')
    
    # Role descriptions
    role_descriptions = {
        'admin': 'Full access to manage the team, members, and settings',
        'designer': 'Can create and manage designs, share designs with others',
        'sales': 'Can manage orders, customers, and sales operations',
        'viewer': 'Read-only access to view team data'
    }
    
    role_description = role_descriptions.get(role, 'Access to team resources')
    
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Invitation - Craftmen</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6; -webkit-font-smoothing: antialiased; width: 100% !important; height: 100% !important;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; max-width: 600px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
                    <!-- Header -->
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px;">
                            <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); -webkit-background-clip: text; color: transparent; font-size: 32px; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                                CRAFTMEN
                            </div>
                            <div style="height: 2px; width: 60px; background: linear-gradient(90deg, #6366f1 0%, #a855f7 100%); border-radius: 1px;"></div>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 20px 40px 40px 40px;">
                            <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Hi {invited_name},</h1>
                            
                            <div style="height: 1px; background: linear-gradient(90deg, rgba(99, 102, 241, 0.3) 0%, transparent 100%); margin-bottom: 24px;"></div>
                            
                            <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin-bottom: 24px; text-align: center;">
                                <strong style="color: #ffffff;">{invited_by_name}</strong> has invited you to join the team
                                <br>
                                <span style="font-size: 18px; font-weight: 600; color: #818cf8;">{team_name}</span>
                                <br>
                                on Craftmen
                            </p>
                            
                            <!-- Role Info -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px;">
                                <tr>
                                    <td style="padding: 8px 0;">
                                        <div style="color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Your Role</div>
                                        <div style="color: #818cf8; font-size: 18px; font-weight: 600; margin-bottom: 8px; text-transform: capitalize;">{role}</div>
                                        <div style="color: #9ca3af; font-size: 14px; line-height: 1.5;">{role_description}</div>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                                <tr>
                                    <td align="center">
                                        <table border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); border-radius: 12px; padding: 0;">
                                                    <a href="{invitation_link}" style="display: inline-block; padding: 14px 40px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 12px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);">
                                                        Accept Invitation
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Alternative Link -->
                            <p style="color: #6b7280; font-size: 13px; text-align: center; margin-bottom: 24px;">
                                Or copy this link into your browser:
                                <br>
                                <span style="color: #818cf8; word-break: break-all;">
                                    <a href="{invitation_link}" style="color: #818cf8; text-decoration: none;">
                                        {invitation_link}
                                    </a>
                                </span>
                            </p>
                            
                            <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.3) 100%); margin-bottom: 24px;"></div>
                            
                            <!-- Info Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: rgba(168, 85, 247, 0.05); border-left: 3px solid #a855f7; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 0 12px;">
                                        <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 0;">
                                            <strong style="color: #d8b4fe;">This invitation will expire in 7 days.</strong> If you don't accept it before then, you'll need to request a new one from the team admin.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #6b7280; font-size: 13px; line-height: 1.6; text-align: center; margin-bottom: 0;">
                                Questions? Reach out to us at <a href="mailto:support@craftmen.com" style="color: #818cf8; text-decoration: none;">support@craftmen.com</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 24px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.04);">
                            <p style="color: #4b5563; font-size: 12px; margin: 0;">
                                &copy; 2026 Craftmen. All rights reserved.
                                <br>
                                <a href="https://craftmen.com" style="color: #6b7280; text-decoration: none;">www.craftmen.com</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""
    return html


def _build_team_invitation_text(team_name: str, variables: dict) -> str:
    """Build plain text email content for team invitation"""
    
    invited_name = variables.get('invited_name', 'Team Member')
    invited_by_name = variables.get('invited_by_name', 'Team Admin')
    invitation_link = variables.get('invitation_link', '#')
    role = variables.get('role', 'Viewer')
    
    text = f"""
Team Invitation - Craftmen
=========================

Hi {invited_name},

{invited_by_name} has invited you to join the team "{team_name}" on Craftmen.

Your Role: {role}

To accept this invitation, click the link below:
{invitation_link}

This invitation will expire in 7 days. If you don't accept it before then, you'll need to request a new one from the team admin.

Questions? Contact us at support@craftmen.com

Best regards,
The Craftmen Team

© 2026 Craftmen. All rights reserved.
www.craftmen.com
"""
    return text.strip()
