import logging
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Email service for sending OTPs and notifications"""
    
    @staticmethod
    def _create_email_log(to_email: str, template_name: str, subject: str, variables: dict) -> Optional[str]:
        """Create a pending email log in the database and return the log ID"""
        from app.core.database import SessionLocal
        from app.models.email_log import EmailLog, EmailStatus
        from app.models.user import User
        import json
        
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == to_email).first()
            user_id = user.id if user else None
            
            email_log = EmailLog(
                to_email=to_email,
                template_name=template_name,
                subject=subject,
                template_variables=json.dumps(variables) if variables else None,
                status=EmailStatus.PENDING,
                user_id=user_id
            )
            db.add(email_log)
            db.commit()
            db.refresh(email_log)
            return str(email_log.id)
        except Exception as e:
            logger.error(f"Failed to create EmailLog for {to_email}: {str(e)}")
            return None
        finally:
            db.close()

    @staticmethod
    def _update_email_log_status(log_id: Optional[str], status: str, error_message: str = None, smtp_response: str = None):
        """Update an existing email log's status in the database"""
        if not log_id:
            return
            
        from app.core.database import SessionLocal
        from app.models.email_log import EmailLog, EmailStatus
        from datetime import datetime, timezone
        
        db = SessionLocal()
        try:
            email_log = db.query(EmailLog).filter(EmailLog.id == log_id).first()
            if email_log:
                email_log.status = status
                if status == EmailStatus.SENT:
                    email_log.sent_at = datetime.now(timezone.utc)
                if error_message is not None:
                    email_log.error_message = error_message
                if smtp_response is not None:
                    email_log.smtp_response = smtp_response
                db.commit()
        except Exception as e:
            logger.error(f"Failed to update EmailLog status for {log_id}: {str(e)}")
        finally:
            db.close()
    
    @staticmethod
    async def send_signup_otp(to: str, otp: str, user_name: str):
        """Send signup OTP email"""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="signup_otp",
            subject="Verify your email address - Craftmen",
            variables={"otp": otp, "user_name": user_name}
        )
        try:
            logger.info(f"SENDING EMAIL: To={to}, OTP={otp}, User={user_name}")
            
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            import asyncio
            
            subject = "Verify your email address - Craftmen"
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify your email</title>
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
                            <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 16px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Verify your email address</h1>
                            
                            <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin-bottom: 28px; text-align: center;">
                                Hi {user_name},<br>
                                Thank you for registering with <strong>Craftmen</strong>. Please use the verification code below to complete your sign-up process.
                            </p>
                            
                            <!-- OTP Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                                <tr>
                                    <td align="center">
                                        <div style="background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; padding: 20px 40px; display: inline-block;">
                                            <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #818cf8; text-shadow: 0 0 10px rgba(129, 140, 248, 0.2);">{otp}</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 28px;">
                                This code is valid for 10 minutes. If you did not request this verification code, please ignore this email.
                            </p>
                            
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 0;">
                                Need assistance? Reach out to us at <a href="mailto:support@craftmen.com" style="color: #818cf8; text-decoration: none;">support@craftmen.com</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 24px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.04);">
                            <p style="color: #4b5563; font-size: 12px; margin: 0;">
                                &copy; 2026 Craftmen. All rights reserved.
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
            text_body = f"Hi {user_name},\n\nYour OTP code is: {otp}\n\nBest regards,\nThe Craftmen Team"
            
            def sync_send():
                msg = MIMEMultipart('alternative')
                msg['Subject'] = subject
                msg['From'] = settings.EMAILS_FROM_EMAIL or settings.SMTP_USER
                msg['To'] = to
                
                msg.attach(MIMEText(text_body, 'plain'))
                msg.attach(MIMEText(html_content, 'html'))
                
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.sendmail(settings.SMTP_USER, [to], msg.as_string())
            
            await asyncio.to_thread(sync_send)
            logger.info(f"Successfully sent signup OTP email to {to}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.SENT,
                smtp_response="Message sent successfully via SMTP"
            )
            
        except Exception as e:
            logger.error(f"Failed to send signup OTP to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e
    
    @staticmethod
    async def send_password_reset_otp(to: str, otp: str, user_name: str):
        """Send password reset OTP email"""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="password_reset_otp",
            subject="Reset your password - Craftmen",
            variables={"otp": otp, "user_name": user_name}
        )
        try:
            logger.info(f"SENDING PASSWORD RESET EMAIL: To={to}, OTP={otp}, User={user_name}")
            
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            import asyncio
            
            subject = "Reset your password - Craftmen"
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your password</title>
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
                            <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 16px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Reset your password</h1>
                            
                            <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin-bottom: 28px; text-align: center;">
                                Hi {user_name},<br>
                                We received a request to reset your password. Please use the security code below to complete the reset.
                            </p>
                            
                            <!-- OTP Box -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                                <tr>
                                    <td align="center">
                                        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 16px; padding: 20px 40px; display: inline-block;">
                                            <span style="font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #f87171; text-shadow: 0 0 10px rgba(248, 113, 113, 0.2);">{otp}</span>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 28px;">
                                This code is valid for 10 minutes. If you did not request a password reset, please ignore this email and ensure your password is secure.
                            </p>
                            
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 0;">
                                Need assistance? Reach out to us at <a href="mailto:support@craftmen.com" style="color: #818cf8; text-decoration: none;">support@craftmen.com</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 24px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.04);">
                            <p style="color: #4b5563; font-size: 12px; margin: 0;">
                                &copy; 2026 Craftmen. All rights reserved.
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
            text_body = f"Hi {user_name},\n\nYour security code is: {otp}\n\nBest regards,\nThe Craftmen Team"
            
            def sync_send():
                msg = MIMEMultipart('alternative')
                msg['Subject'] = subject
                msg['From'] = settings.EMAILS_FROM_EMAIL or settings.SMTP_USER
                msg['To'] = to
                
                msg.attach(MIMEText(text_body, 'plain'))
                msg.attach(MIMEText(html_content, 'html'))
                
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.sendmail(settings.SMTP_USER, [to], msg.as_string())
            
            await asyncio.to_thread(sync_send)
            logger.info(f"Successfully sent password reset OTP email to {to}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.SENT,
                smtp_response="Message sent successfully via SMTP"
            )
            
        except Exception as e:
            logger.error(f"Failed to send password reset OTP to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e
    
    @staticmethod
    async def send_welcome_email(to: str, user_name: str):
        """Send welcome email after successful verification"""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="welcome",
            subject="Welcome to Craftmen!",
            variables={"user_name": user_name}
        )
        try:
            logger.info(f"SENDING WELCOME EMAIL: To={to}, User={user_name}")
            
            import smtplib
            from email.mime.multipart import MIMEMultipart
            from email.mime.text import MIMEText
            import asyncio
            
            subject = "Welcome to Craftmen!"
            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Craftmen</title>
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
                            <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin-top: 0; margin-bottom: 16px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: linear-gradient(135deg, #a5b4fc 0%, #c084fc 100%); -webkit-background-clip: text; color: transparent;">Welcome to the family!</h1>
                            
                            <p style="color: #9ca3af; font-size: 16px; line-height: 1.8; margin-bottom: 28px; text-align: center;">
                                Hi {user_name},<br>
                                We are absolutely thrilled to welcome you to <strong>Craftmen</strong>! Your email address has been successfully verified, and your account is now fully active.
                            </p>
                            
                            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 24px; margin-bottom: 32px; text-align: left;">
                                <h3 style="color: #ffffff; margin-top: 0; margin-bottom: 12px; font-size: 16px;">What's next?</h3>
                                <ul style="color: #9ca3af; padding-left: 20px; margin: 0; line-height: 1.6; font-size: 15px;">
                                    <li style="margin-bottom: 8px;">Explore our platform and setup your profile</li>
                                    <li style="margin-bottom: 8px;">Connect with other craftsmen and partners</li>
                                    <li>Discover advanced features tailored just for you</li>
                                </ul>
                            </div>
                            
                            <p style="color: #9ca3af; font-size: 15px; line-height: 1.7; text-align: center; margin-bottom: 28px;">
                                If you have any questions or need a hand getting started, simply reply to this email or drop us a line at support.
                            </p>
                            
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 0;">
                                Cheers,<br>
                                <strong>The Craftmen Team</strong>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 24px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.04);">
                            <p style="color: #4b5563; font-size: 12px; margin: 0;">
                                &copy; 2026 Craftmen. All rights reserved.
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
            text_body = f"Hi {user_name},\n\nWelcome to Craftmen! Your email address has been successfully verified.\n\nBest regards,\nThe Craftmen Team"
            
            def sync_send():
                msg = MIMEMultipart('alternative')
                msg['Subject'] = subject
                msg['From'] = settings.EMAILS_FROM_EMAIL or settings.SMTP_USER
                msg['To'] = to
                
                msg.attach(MIMEText(text_body, 'plain'))
                msg.attach(MIMEText(html_content, 'html'))
                
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.sendmail(settings.SMTP_USER, [to], msg.as_string())
            
            await asyncio.to_thread(sync_send)
            logger.info(f"Successfully sent welcome email to {to}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.SENT,
                smtp_response="Message sent successfully via SMTP"
            )
            
        except Exception as e:
            logger.error(f"Failed to send welcome email to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e
