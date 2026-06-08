"""
Email-related background tasks using Celery
All email sending operations are handled here
"""

from datetime import datetime, timezone
import logging
import json

from app.core.config import settings
from app.services.email_service import EmailService
from app.tasks.base import create_task
import httpx

logger = logging.getLogger(__name__)


def _send_via_zeptomail_sync(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
    from_email: str = None
) -> dict:
    """
    Synchronous ZeptoMail email sender for use in Celery tasks
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_content: HTML body content
        text_content: Plain text body content
        from_email: Optional override sender email (defaults to ZEPTOMAIL_FROM_EMAIL)
    
    Returns:
        dict with keys: success (bool), message (str)
    """
    if not settings.ZEPTOMAIL_API_KEY:
        raise ValueError("ZEPTOMAIL_API_KEY is not configured")
    
    from_email = from_email or settings.ZEPTOMAIL_FROM_EMAIL or "noreply@craftmen.com"
    from_name = settings.ZEPTOMAIL_FROM_NAME
    
    payload = {
        "from": {
            "address": from_email,
            "name": from_name
        },
        "to": [
            {
                "email_address": {
                    "address": to_email
                }
            }
        ],
        "subject": subject,
        "htmlbody": html_content,
        "textbody": text_content
    }
    
    headers = {
        "Authorization": f"Zoho-enczapikey {settings.ZEPTOMAIL_API_KEY}",
        "Content-Type": "application/json"
    }
    
    response = httpx.post(
        settings.ZEPTOMAIL_API_URL,
        json=payload,
        headers=headers,
        timeout=30.0
    )
    
    if response.status_code in (200, 201, 202):
        return {"success": True, "message": "Email sent successfully via ZeptoMail"}
    else:
        error_detail = f"ZeptoMail API error: {response.status_code} - {response.text}"
        logger.error(error_detail)
        return {"success": False, "message": error_detail}


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
    db = None
    email_log_id = None
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        from app.core.database import SessionLocal
        from app.models.email_log import EmailLog, EmailStatus
        
        db = SessionLocal()
        retry_count = getattr(self.request, "retries", 0)
        
        # Create email log
        email_log = EmailLog(
            to_email=to,
            template_name="signup_otp",
            subject="Your Craftmen Signup OTP",
            template_variables=json.dumps({
                "otp": otp,
                "user_name": user_name,
            }),
            status=EmailStatus.PENDING,
            retry_count=retry_count,
        )
        db.add(email_log)
        db.commit()
        db.refresh(email_log)
        email_log_id = str(email_log.id)
        
        # Run async email service in sync context
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_signup_otp(to, otp, user_name)
        )
        
        # Update email log to SENT
        email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
        if email_log:
            email_log.status = EmailStatus.SENT
            email_log.retry_count = retry_count
            email_log.error_message = None
            email_log.smtp_response = "Message sent successfully via ZeptoMail"
            email_log.sent_at = datetime.now(timezone.utc)
            db.commit()
        
        logger.info(f"✅ {task_name} completed successfully for {to}")
        return True
        
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to}: {str(exc)}")
        
        try:
            if db and email_log_id:
                email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
                if email_log:
                    retry_count = getattr(self.request, "retries", 0) + 1
                    email_log.retry_count = retry_count
                    email_log.error_message = str(exc)
                    if getattr(self.request, "retries", 0) >= self.max_retries:
                        email_log.status = EmailStatus.FAILED
                        email_log.smtp_response = str(exc)
                    else:
                        email_log.status = EmailStatus.RETRYING
                        email_log.smtp_response = str(exc)
                    db.commit()
        except Exception as log_exc:
            logger.error(f"Failed to update email log: {str(log_exc)}")
        
        # Retry with exponential backoff
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )
    finally:
        try:
            if db:
                db.close()
        except Exception:
            pass


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
    db = None
    email_log_id = None
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        from app.core.database import SessionLocal
        from app.models.email_log import EmailLog, EmailStatus
        
        db = SessionLocal()
        retry_count = getattr(self.request, "retries", 0)
        
        # Create email log
        email_log = EmailLog(
            to_email=to,
            template_name="password_reset_otp",
            subject="Your Craftmen Password Reset OTP",
            template_variables=json.dumps({
                "otp": otp,
                "user_name": user_name,
            }),
            status=EmailStatus.PENDING,
            retry_count=retry_count,
        )
        db.add(email_log)
        db.commit()
        db.refresh(email_log)
        email_log_id = str(email_log.id)
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_password_reset_otp(to, otp, user_name)
        )
        
        # Update email log to SENT
        email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
        if email_log:
            email_log.status = EmailStatus.SENT
            email_log.retry_count = retry_count
            email_log.error_message = None
            email_log.smtp_response = "Message sent successfully via ZeptoMail"
            email_log.sent_at = datetime.now(timezone.utc)
            db.commit()
        
        logger.info(f"✅ {task_name} completed successfully for {to}")
        return True
        
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to}: {str(exc)}")
        
        try:
            if db and email_log_id:
                email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
                if email_log:
                    retry_count = getattr(self.request, "retries", 0) + 1
                    email_log.retry_count = retry_count
                    email_log.error_message = str(exc)
                    if getattr(self.request, "retries", 0) >= self.max_retries:
                        email_log.status = EmailStatus.FAILED
                        email_log.smtp_response = str(exc)
                    else:
                        email_log.status = EmailStatus.RETRYING
                        email_log.smtp_response = str(exc)
                    db.commit()
        except Exception as log_exc:
            logger.error(f"Failed to update email log: {str(log_exc)}")
        
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )
    finally:
        try:
            if db:
                db.close()
        except Exception:
            pass


@create_task(name="send_welcome_email", max_retries=3)
def send_welcome_email(self, to: str, user_name: str, dashboard_url: str = "#"):
    """
    Send welcome email using Celery
    
    Args:
        to: Recipient email address
        user_name: Name of the user
        dashboard_url: Dashboard URL for the user
    """
    task_name = "send_welcome_email"
    db = None
    email_log_id = None
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        from app.core.database import SessionLocal
        from app.models.email_log import EmailLog, EmailStatus
        
        db = SessionLocal()
        retry_count = getattr(self.request, "retries", 0)
        
        # Create email log
        email_log = EmailLog(
            to_email=to,
            template_name="welcome_platform",
            subject="Welcome to Craftmen",
            template_variables=json.dumps({
                "user_name": user_name,
                "dashboard_url": dashboard_url,
            }),
            status=EmailStatus.PENDING,
            retry_count=retry_count,
        )
        db.add(email_log)
        db.commit()
        db.refresh(email_log)
        email_log_id = str(email_log.id)
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_welcome_email(to, user_name, dashboard_url)
        )
        
        # Update email log to SENT
        email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
        if email_log:
            email_log.status = EmailStatus.SENT
            email_log.retry_count = retry_count
            email_log.error_message = None
            email_log.smtp_response = "Message sent successfully via ZeptoMail"
            email_log.sent_at = datetime.now(timezone.utc)
            db.commit()
        
        logger.info(f"✅ {task_name} completed successfully for {to}")
        return True
        
    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to}: {str(exc)}")
        
        try:
            if db and email_log_id:
                email_log = db.query(EmailLog).filter(EmailLog.id == email_log_id).first()
                if email_log:
                    retry_count = getattr(self.request, "retries", 0) + 1
                    email_log.retry_count = retry_count
                    email_log.error_message = str(exc)
                    if getattr(self.request, "retries", 0) >= self.max_retries:
                        email_log.status = EmailStatus.FAILED
                        email_log.smtp_response = str(exc)
                    else:
                        email_log.status = EmailStatus.RETRYING
                        email_log.smtp_response = str(exc)
                    db.commit()
        except Exception as log_exc:
            logger.error(f"Failed to update email log: {str(log_exc)}")
        
        raise self.retry(
            exc=exc, 
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )
    finally:
        try:
            if db:
                db.close()
        except Exception:
            pass


@create_task(name="send_design_review_email", max_retries=3)
def send_design_review_email(
    self,
    to_email: str,
    customer_name: str,
    review_url: str,
    design_name: str,
    variant_name: str,
    email_log_id: str = None,
):
    """
    Send a design review link email using Celery.

    Args:
        to_email: Recipient email address
        customer_name: Customer's display name
        review_url: Frontend review link containing the public token
        design_name: Name of the design being shared
        variant_name: Name of the shared variant
    """
    task_name = "send_design_review_email"

    db = None

    try:
        logger.info(f"📧 Starting {task_name} for {to_email}")

        from app.core.database import SessionLocal
        from app.models.email_log import EmailLog, EmailStatus

        subject = f"Review your Craftmen design: {design_name}"

        db = SessionLocal()
        retry_count = getattr(self.request, "retries", 0)

        if email_log_id:
            email_log = (
                db.query(EmailLog)
                .filter(EmailLog.id == email_log_id)
                .first()
            )
        else:
            email_log = None

        if email_log is None:
            email_log = EmailLog(
                to_email=to_email,
                template_name="design_review",
                subject=subject,
                template_variables=json.dumps({
                    "customer_name": customer_name,
                    "review_url": review_url,
                    "design_name": design_name,
                    "variant_name": variant_name,
                }),
                status=EmailStatus.PENDING,
                retry_count=0,
            )

            db.add(email_log)
            db.commit()
            db.refresh(email_log)

            email_log_id = str(email_log.id)

        safe_variant_name = variant_name or "Design Variant"

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review your design</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6; -webkit-font-smoothing: antialiased; width: 100% !important; height: 100% !important;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.08); overflow: hidden; max-width: 600px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04);">
                    <tr>
                        <td align="center" style="padding: 40px 40px 20px 40px;">
                            <div style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); -webkit-background-clip: text; color: transparent; font-size: 32px; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
                                CRAFTMEN
                            </div>
                            <div style="height: 2px; width: 60px; background: linear-gradient(90deg, #6366f1 0%, #a855f7 100%); border-radius: 1px;"></div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px 40px 40px;">
                            <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 16px; text-align: center;">
                                Your design is ready for review
                            </h1>

                            <p style="color: #9ca3af; font-size: 16px; line-height: 1.7; margin-bottom: 24px; text-align: center;">
                                Hi {customer_name},<br>
                                <strong>{design_name}</strong> ({safe_variant_name}) has been shared with you for review.
                            </p>

                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                                <tr>
                                    <td align="center">
                                        <a href="{review_url}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 28px; border-radius: 9999px;">
                                            Review design
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 16px;">
                                If the button does not open, use the link below:
                            </p>

                            <p style="word-break: break-all; color: #818cf8; font-size: 13px; line-height: 1.6; text-align: center; margin-bottom: 0;">
                                <a href="{review_url}" style="color: #818cf8; text-decoration: none;">
                                    {review_url}
                                </a>
                            </p>
                        </td>
                    </tr>

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

        text_content = (
            f"Hi {customer_name},\n\n"
            f"{design_name} ({safe_variant_name}) has been shared with you for review.\n\n"
            f"Open this link to review it:\n{review_url}\n\n"
            "Best regards,\nThe Craftmen Team"
        )

        # Send via ZeptoMail - design review emails use ZEPTOMAIL_CUSTOMER_EMAIL
        result = _send_via_zeptomail_sync(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            from_email=settings.ZEPTOMAIL_CUSTOMER_EMAIL
        )
        
        if not result["success"]:
            raise Exception(result["message"])

        # Mark email log as sent
        email_log = (
            db.query(EmailLog)
            .filter(EmailLog.id == email_log_id)
            .first()
        )

        if email_log:
            email_log.status = EmailStatus.SENT
            email_log.retry_count = retry_count
            email_log.error_message = None
            email_log.smtp_response = "Message sent successfully via ZeptoMail"
            email_log.sent_at = datetime.now(timezone.utc)
            db.commit()

        logger.info(f"✅ {task_name} completed successfully for {to_email}")

        return True

    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to_email}: {str(exc)}")

        try:
            if db and email_log_id:
                email_log = (
                    db.query(EmailLog)
                    .filter(EmailLog.id == email_log_id)
                    .first()
                )

                if email_log:
                    retry_count = getattr(self.request, "retries", 0) + 1
                    email_log.retry_count = retry_count
                    email_log.error_message = str(exc)
                    if getattr(self.request, "retries", 0) >= self.max_retries:
                        email_log.status = EmailStatus.FAILED
                        email_log.smtp_response = str(exc)
                    else:
                        email_log.status = EmailStatus.RETRYING
                        email_log.smtp_response = str(exc)
                    db.commit()

        except Exception as log_exc:
            logger.error(
                f"Failed to update email log: {str(log_exc)}"
            )

        retry_kwargs = dict(getattr(self.request, "kwargs", {}) or {})
        retry_kwargs["email_log_id"] = email_log_id

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3,
            kwargs=retry_kwargs,
        )

    finally:
        try:
            if db:
                db.close()
        except Exception:
            pass


@create_task(name="send_customer_share_sms", max_retries=3)
def send_customer_share_sms(self, to_number: str, customer_name: str, preview_url: str, designer_name: str, design_code: str = None, retailer_phone: str = None, retailer_email: str = None, retailer_address: str = ""):
    """
    Send an SMS to a customer with a link to review a shared design using the customer_sms_design_share template.
    """
    task_name = "send_customer_share_sms"
    try:
        logger.info(f"📱 Starting {task_name} for {to_number}")
        
        from app.services.sms_service import sms_service
        from app.services.template_renderer import render_template_sync
        from bs4 import BeautifulSoup
        
        if not sms_service.is_configured():
            logger.warning(f"⚠️ {task_name}: SMS service not configured.")
            return False
        
        # Render the template with context
        context = {
            "retailer_name": designer_name,
            "approval_url": preview_url,
            "design_number": design_code or "",
            "retailer_phone": retailer_phone or "",
            "retailer_email": retailer_email or "",
            "retailer_address": retailer_address or ""
        }
        
        rendered_html = render_template_sync("customer_sms_design_share", context)
        
        # Extract the SMS text from the template
        soup = BeautifulSoup(rendered_html, 'html.parser')
        sms_text_element = soup.find(class_='sms-text')
        if sms_text_element:
            # Get text and clean up extra whitespace
            message = sms_text_element.get_text(separator=' ', strip=True)
            # Remove the link text and keep just the URL
            message = message.replace("craftsmanai.app/review/", "").strip()
            # Reconstruct the message properly
            message = f"{designer_name} sent your custom pendant design for approval. Review, approve, or request changes here: {preview_url}"
        else:
            # Fallback message if template parsing fails
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
def send_customer_share_email(self, to_email: str, customer_name: str, preview_url: str, designer_name: str, retailer_name: str = None, render_image_url: str = None, design_code: str = None, jewelry_type: str = None, version: str = None, version_label: str = None):
    """
    Send an email to a customer with a link to review a shared design using customer_approval template.
    """
    task_name = "send_customer_share_email"
    try:
        logger.info(f"📧 Starting {task_name} for {to_email}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_customer_share(to_email, customer_name, preview_url, designer_name, retailer_name, render_image_url, design_code, jewelry_type, version, version_label)
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


@create_task(name="send_manufacturer_share_sms", max_retries=3)
def send_manufacturer_share_sms(self, to_number: str, manufacturer_name: str, preview_url: str, designer_name: str, retailer_name: str = None, design_code: str = None, retailer_phone: str = None, retailer_email: str = None, retailer_address: str = ""):
    """
    Send an SMS to a manufacturer with a link to review a shared design using manufacturer_sms_design_share template.
    """
    task_name = "send_manufacturer_share_sms"
    try:
        logger.info(f"📱 Starting {task_name} for {to_number}")
        
        from app.services.sms_service import sms_service
        from app.services.template_renderer import render_template_sync
        from bs4 import BeautifulSoup
        
        if not sms_service.is_configured():
            logger.warning(f"⚠️ {task_name}: SMS service not configured.")
            return False
        
        # Render the template with context
        context = {
            "retailer_name": retailer_name or designer_name,
            "design_number": design_code or "",
            "details_sheet_url": preview_url,
            "retailer_phone": retailer_phone or "",
            "retailer_email": retailer_email or "",
            "retailer_address": retailer_address or ""
        }
        
        rendered_html = render_template_sync("manufacturer_sms_design_share", context)
        
        # Extract the SMS text from the template
        soup = BeautifulSoup(rendered_html, 'html.parser')
        sms_text_element = soup.find(class_='sms-text')
        if sms_text_element:
            # Get text and clean up extra whitespace
            message = sms_text_element.get_text(separator=' ', strip=True)
            # Remove the link text and keep just the URL
            message = message.replace("craftsmanai.app/manu/manufacturer/", "").strip()
            # Reconstruct the message properly
            message = f"New quote request from {retailer_name or designer_name}: {design_code or ''}. View the Details Sheet and submit costing here: {preview_url}"
        else:
            # Fallback message if template parsing fails
            message = f"Hi {manufacturer_name}, {designer_name} has shared a design variant with you for quoting! View it here: {preview_url}"
        
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


@create_task(name="send_manufacturer_share_email", max_retries=3)
def send_manufacturer_share_email(self, to_email: str, manufacturer_name: str, preview_url: str, designer_name: str, retailer_name: str = None, render_image_url: str = None, design_code: str = None, jewelry_type: str = None, metal: str = None):
    """
    Send an email to a manufacturer with a link to review a shared design using manufacturer_design_share template.
    """
    task_name = "send_manufacturer_share_email"
    try:
        logger.info(f"📧 Starting {task_name} for {to_email}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_manufacturer_share(to_email, manufacturer_name, preview_url, designer_name, retailer_name, render_image_url, design_code, jewelry_type, metal)
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
        
        # Send via ZeptoMail
        result = _send_via_zeptomail_sync(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
        
        if not result["success"]:
            raise Exception(result["message"])
        
        # Update log status
        email_log = db.query(EmailLog).filter(EmailLog.id == log_id).first()
        if email_log:
            email_log.status = EmailStatus.SENT
            email_log.smtp_response = "Message sent successfully via ZeptoMail"
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