"""
Email-related background tasks using Celery
All email sending operations are handled here
"""

from app.core.timezone import now as tz_now
import logging
import json

from app.core.config import settings
from app.services.email_service import EmailService
from app.tasks.base import create_task
import httpx

logger = logging.getLogger(__name__)


def _validate_email_address(to_email: str) -> bool:
    """Validate email address format before sending."""
    import re
    if not to_email or not isinstance(to_email, str):
        return False
    # Basic email validation regex
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, to_email.strip()))


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
    # Validate recipient email address before sending
    if not _validate_email_address(to_email):
        error_msg = f"Invalid recipient email address: {to_email}"
        logger.error(error_msg)
        return {"success": False, "message": error_msg}
    
    if not settings.ZEPTOMAIL_API_KEY:
        raise ValueError("ZEPTOMAIL_API_KEY is not configured")
    
    from_email = from_email or settings.ZEPTOMAIL_FROM_EMAIL or "noreply@craftsmanai.com"
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
    
    # Validate email address before proceeding
    if not _validate_email_address(to):
        error_msg = f"Invalid recipient email address: {to}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
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
            subject="Your Craftsman AI Signup OTP",
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
            email_log.sent_at = tz_now()
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
    
    # Validate email address before proceeding
    if not _validate_email_address(to):
        error_msg = f"Invalid recipient email address: {to}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
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
            subject="Your Craftsman AI Password Reset OTP",
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
            email_log.sent_at = tz_now()
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
    
    # Validate email address before proceeding
    if not _validate_email_address(to):
        error_msg = f"Invalid recipient email address: {to}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
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
            subject="Welcome to Craftsman AI",
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
            email_log.sent_at = tz_now()
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

        subject = f"Review your Craftsman AI design: {design_name}"

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
                                Craftsman AI
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
                                &copy; 2026 Craftsman AI. All rights reserved.
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
            "Best regards,\nThe Craftsman AI Team"
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
            email_log.sent_at = tz_now()
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
def send_customer_share_sms(self, to_number: str, customer_name: str, preview_url: str, designer_name: str, design_code: str = None, retailer_phone: str = None, retailer_email: str = None, retailer_address: str = "", render_image_url: str = None):
    """
    Send an SMS to a customer with a link to review a shared design using the customer_sms_design_share template.
    
    Args:
        to_number: Recipient phone number
        customer_name: Customer's display name
        preview_url: URL for the customer to review the design
        designer_name: Name of the designer who shared the design
        design_code: Design code/number
        retailer_phone: Retailer's phone number for contact info
        retailer_email: Retailer's email for contact info
        retailer_address: Retailer's address for contact info
        render_image_url: URL of the design render image to display in the rich preview
    """
    task_name = "send_customer_share_sms"
    try:
        logger.info(f"📱 Starting {task_name} for {to_number}")
        
        from app.services.sms_service import sms_service, SMSPermanentError
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
            "retailer_address": retailer_address or "",
            "render_url": render_image_url or ""
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

    except SMSPermanentError as exc:
        # PERMANENT Twilio failure — e.g. 21408 (region not enabled in Geo Permissions: the India
        # failures) or 30007 (carrier violation from the unverified US toll-free sender). A retry can
        # NEVER deliver these: it only turns ONE failed message into FOUR (1 send + 3 retries) and keeps
        # hitting the Twilio API on the 60s / 120s / 240s backoff — exactly the "240 failed outbound
        # messages" and "Twilio called every 2 minutes" the client reported. Fail fast, log the real code.
        logger.error(
            "❌ %s PERMANENTLY failed for %s — %s. NOT retrying (fix this in the Twilio console).",
            task_name, to_number, exc,
        )
        return False

    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to_number}: {str(exc)}")
        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )


@create_task(name="send_customer_share_email", max_retries=3)
def send_customer_share_email(self, to_email: str, customer_name: str, preview_url: str, designer_name: str, retailer_name: str = None, render_image_url: str = None, design_code: str = None, jewelry_type: str = None, version: str = None, version_label: str = None, brand_logo_url: str = None, brand_primary_color: str = None):
    """
    Send an email to a customer with a link to review a shared design using customer_approval template.
    """
    task_name = "send_customer_share_email"
    
    # Validate email address before proceeding
    if not _validate_email_address(to_email):
        error_msg = f"Invalid recipient email address: {to_email}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to_email}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_customer_share(to_email, customer_name, preview_url, designer_name, retailer_name, render_image_url, design_code, jewelry_type, version, version_label, brand_logo_url, brand_primary_color)
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
def send_manufacturer_share_sms(self, to_number: str, manufacturer_name: str, preview_url: str, designer_name: str, retailer_name: str = None, design_code: str = None, retailer_phone: str = None, retailer_email: str = None, retailer_address: str = "", render_image_url: str = None):
    """
    Send an SMS to a manufacturer with a link to review a shared design using manufacturer_sms_design_share template.
    
    Args:
        to_number: Recipient phone number
        manufacturer_name: Manufacturer's display name
        preview_url: URL for the manufacturer to review the design
        designer_name: Name of the designer who shared the design
        retailer_name: Retailer/brand name
        design_code: Design code/number
        retailer_phone: Retailer's phone number for contact info
        retailer_email: Retailer's email for contact info
        retailer_address: Retailer's address for contact info
        render_image_url: URL of the design render image to display in the rich preview
    """
    task_name = "send_manufacturer_share_sms"
    try:
        logger.info(f"📱 Starting {task_name} for {to_number}")
        
        from app.services.sms_service import sms_service, SMSPermanentError
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
            "retailer_address": retailer_address or "",
            "render_url": render_image_url or ""
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

    except SMSPermanentError as exc:
        # PERMANENT Twilio failure — e.g. 21408 (region not enabled in Geo Permissions: the India
        # failures) or 30007 (carrier violation from the unverified US toll-free sender). A retry can
        # NEVER deliver these: it only turns ONE failed message into FOUR (1 send + 3 retries) and keeps
        # hitting the Twilio API on the 60s / 120s / 240s backoff — exactly the "240 failed outbound
        # messages" and "Twilio called every 2 minutes" the client reported. Fail fast, log the real code.
        logger.error(
            "❌ %s PERMANENTLY failed for %s — %s. NOT retrying (fix this in the Twilio console).",
            task_name, to_number, exc,
        )
        return False

    except Exception as exc:
        logger.error(f"❌ {task_name} failed for {to_number}: {str(exc)}")
        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3
        )


@create_task(name="send_manufacturer_share_email", max_retries=3)
def send_manufacturer_share_email(self, to_email: str, manufacturer_name: str, preview_url: str, designer_name: str, retailer_name: str = None, render_image_url: str = None, design_code: str = None, jewelry_type: str = None, metal: str = None, brand_logo_url: str = None, brand_primary_color: str = None):
    """
    Send an email to a manufacturer with a link to review a shared design using manufacturer_design_share template.
    """
    task_name = "send_manufacturer_share_email"
    
    # Validate email address before proceeding
    if not _validate_email_address(to_email):
        error_msg = f"Invalid recipient email address: {to_email}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to_email}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_manufacturer_share(to_email, manufacturer_name, preview_url, designer_name, retailer_name, render_image_url, design_code, jewelry_type, metal, brand_logo_url, brand_primary_color)
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


@create_task(name="send_customer_action_email_task", max_retries=3)
def send_customer_action_email_task(
    self,
    to_email: str,
    retailer_name: str,
    customer_name: str,
    action: str,
    design_name: str,
    variant_name: str,
    design_code: str = None,
    jewelry_type: str = None,
    version: str = None,
    version_label: str = None,
    render_image_url: str = None,
    brand_logo_url: str = None,
    brand_primary_color: str = None,
    comment: str = None,
):
    """
    Send an email to the retailer when a customer takes action on a shared design
    (approve, reject, or request refinement).
    """
    task_name = "send_customer_action_email_task"
    
    # Validate email address before proceeding
    if not _validate_email_address(to_email):
        error_msg = f"Invalid recipient email address: {to_email}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to_email} - Action: {action}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_customer_action_email(
                to_email=to_email,
                retailer_name=retailer_name,
                customer_name=customer_name,
                action=action,
                design_name=design_name,
                variant_name=variant_name,
                design_code=design_code,
                jewelry_type=jewelry_type,
                version=version,
                version_label=version_label,
                render_image_url=render_image_url,
                brand_logo_url=brand_logo_url,
                brand_primary_color=brand_primary_color,
                comment=comment,
            )
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


@create_task(name="send_contact_notification_email", max_retries=3)
def send_contact_notification_email(self, full_name: str, business_name: str, email: str, phone: str = None, store_type: str = None, interest: str = None):
    """
    Send contact form notification email using Celery.

    Args:
        full_name: Sender's full name
        business_name: Business name
        email: Sender's email address
        phone: Sender's phone number (optional)
        store_type: Type of store (optional)
        interest: What they are interested in (optional)

    Retry Logic:
        - 3 max retries
        - 60s initial delay, exponential backoff
    """
    task_name = "send_contact_notification_email"

    try:
        logger.info(f"📧 Starting {task_name} from {full_name} ({email})")

        to_email = settings.CONTACT_NOTIFICATION_EMAIL
        email_subject = f"New Contact Form Submission: {business_name} - Craftsman AI"

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #1a1a2e;">New Contact Form Submission</h2>
            <hr style="border: 1px solid #eee;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px; font-weight: bold; width: 140px; color: #555;">Full Name:</td>
                    <td style="padding: 10px;">{full_name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; font-weight: bold; color: #555;">Business Name:</td>
                    <td style="padding: 10px;">{business_name}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; font-weight: bold; color: #555;">Email:</td>
                    <td style="padding: 10px;"><a href="mailto:{email}">{email}</a></td>
                </tr>
                <tr>
                    <td style="padding: 10px; font-weight: bold; color: #555;">Phone:</td>
                    <td style="padding: 10px;">{phone or "Not provided"}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; font-weight: bold; color: #555;">Store Type:</td>
                    <td style="padding: 10px;">{store_type or "Not provided"}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; font-weight: bold; color: #555;">Interest:</td>
                    <td style="padding: 10px;">{interest or "Not provided"}</td>
                </tr>
            </table>
            <hr style="border: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
                This email was sent from the Craftsman AI contact form.
            </p>
        </body>
        </html>
        """

        text_content = f"""
New Contact Form Submission

Full Name: {full_name}
Business Name: {business_name}
Email: {email}
Phone: {phone or "Not provided"}
Store Type: {store_type or "Not provided"}
Interest: {interest or "Not provided"}
        """.strip()

        result = _send_via_zeptomail_sync(
            to_email=to_email,
            subject=email_subject,
            html_content=html_content,
            text_content=text_content,
            from_email=settings.ZEPTOMAIL_FROM_EMAIL,
        )

        if not result["success"]:
            raise Exception(result["message"])

        logger.info(f"✅ {task_name} completed successfully for {to_email}")
        return True

    except Exception as exc:
        logger.error(f"❌ {task_name} failed: {str(exc)}")
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
    
    # Validate email address before proceeding
    if not _validate_email_address(to_email):
        error_msg = f"Invalid recipient email address: {to_email}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to_email} to join {team_name}")
        
        from app.core.database import SessionLocal
        from app.models.email_log import EmailLog, EmailStatus
        from app.core.config import settings
        
        db = SessionLocal()
        
        subject = f"You're invited to join {team_name} on Craftsman AI"
        
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
    <title>Team Invitation - Craftsman AI</title>
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
                                Craftsman AI
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
                                on Craftsman AI
                            </p>
                            
                            <!-- Role Info -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 16px;">
                                <tr>
                                    <td style="padding-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #818cf8; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Your Role</td>
                                </tr>
                                <tr>
                                    <td style="font-size: 16px; font-weight: 600; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">{role.title()}</td>
                                </tr>
                                <tr>
                                    <td style="font-size: 13px; color: #9ca3af; padding-top: 4px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">{role_description}</td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                                <tr>
                                    <td align="center">
                                        <table border="0" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td align="center" style="border-radius: 9999px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 14px 32px;">
                                                    <a href="{invitation_link}" style="color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: inline-block;">Accept invitation</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; text-align: center; margin-bottom: 0;">
                                If the button does not open, use the link below:
                            </p>
                            <p style="word-break: break-all; color: #818cf8; font-size: 13px; line-height: 1.6; text-align: center; margin-bottom: 0;">
                                <a href="{invitation_link}" style="color: #818cf8; text-decoration: none;">{invitation_link}</a>
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 24px 40px; background-color: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(255, 255, 255, 0.04);">
                            <p style="color: #4b5563; font-size: 12px; margin: 0;">
                                &copy; 2026 Craftsman AI. All rights reserved.
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
Hi {invited_name},

{invited_by_name} has invited you to join the team {team_name} on Craftsman AI.

Your role: {role.title()}

Open this link to accept the invitation:
{invitation_link}

Best regards,
The Craftsman AI Team
""".strip()
    return text


@create_task(name="send_quote_submitted_email", max_retries=3)
def send_quote_submitted_email(self, to: str, retailer_name: str, manufacturer_name: str, design_number: str, estimated_cost: str, production_timeline: str, design_id: int = None, render_image_url: str = "", brand_logo_url: str = None, brand_primary_color: str = None):
    """
    Send quote submitted notification email to retailer.
    """
    task_name = "send_quote_submitted_email"
    
    # Validate email address before proceeding
    if not _validate_email_address(to):
        error_msg = f"Invalid recipient email address: {to}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_quote_submitted_email(to, retailer_name, manufacturer_name, design_number, estimated_cost, production_timeline, design_id, render_image_url, brand_logo_url, brand_primary_color)
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


@create_task(name="send_subscription_cancellation_confirmation_email", max_retries=3)
def send_subscription_cancellation_confirmation_email(self, to: str, user_name: str, plan_name: str, access_end_date: str, cancellation_date: str, manage_billing_url: str = "#"):
    """
    Send subscription cancellation confirmation email using Celery.
    
    Args:
        to: Recipient email address
        user_name: User's name
        plan_name: Name of the cancelled plan
        access_end_date: Date until access remains active
        cancellation_date: Date of cancellation
        manage_billing_url: URL to manage billing
    """
    task_name = "send_subscription_cancellation_confirmation_email"
    
    # Validate email address before proceeding
    if not _validate_email_address(to):
        error_msg = f"Invalid recipient email address: {to}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_subscription_cancellation_confirmation(to, user_name, plan_name, access_end_date, cancellation_date, manage_billing_url)
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


@create_task(name="send_subscription_renewal_confirmation_email", max_retries=3)
def send_subscription_renewal_confirmation_email(self, to: str, user_name: str, plan_name: str, amount: str, next_renewal_date: str, invoice_url: str = "#"):
    """
    Send subscription renewal confirmation email using Celery.
    
    Args:
        to: Recipient email address
        user_name: User's name
        plan_name: Name of the renewed plan
        amount: Renewal amount
        next_renewal_date: Next renewal date
        invoice_url: URL to view invoice
    """
    task_name = "send_subscription_renewal_confirmation_email"
    
    # Validate email address before proceeding
    if not _validate_email_address(to):
        error_msg = f"Invalid recipient email address: {to}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_subscription_renewal_confirmation(to, user_name, plan_name, amount, next_renewal_date, invoice_url)
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


@create_task(name="send_plan_purchase_confirmation_email", max_retries=3)
def send_plan_purchase_confirmation_email(self, to: str, user_name: str, plan_name: str, amount: str, billing_date: str, billing_url: str = "#"):
    """
    Send plan purchase confirmation email using Celery.
    
    Args:
        to: Recipient email address
        user_name: User's name
        plan_name: Name of the purchased plan
        amount: Plan amount
        billing_date: Billing date
        billing_url: URL to view billing details
    """
    task_name = "send_plan_purchase_confirmation_email"
    
    # Validate email address before proceeding
    if not _validate_email_address(to):
        error_msg = f"Invalid recipient email address: {to}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_plan_purchase_confirmation_email(to, user_name, plan_name, amount, billing_date, billing_url)
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


@create_task(name="send_topup_purchase_confirmation_email", max_retries=3)
def send_topup_purchase_confirmation_email(self, to: str, user_name: str, plan_name: str, amount: str, billing_date: str, billing_url: str = "#"):
    """
    Send top-up pack purchase confirmation email using Celery.
    
    Args:
        to: Recipient email address
        user_name: User's name
        plan_name: Name of the top-up pack
        amount: Plan amount
        billing_date: Billing date
        billing_url: URL to view billing details
    """
    task_name = "send_topup_purchase_confirmation_email"
    
    # Validate email address before proceeding
    if not _validate_email_address(to):
        error_msg = f"Invalid recipient email address: {to}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_topup_purchase_confirmation_email(to, user_name, plan_name, amount, billing_date, billing_url)
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


@create_task(name="send_plan_upgrade_confirmation_email", max_retries=3)
def send_plan_upgrade_confirmation_email(self, to: str, user_name: str, new_plan: str, amount: str, next_invoice_date: str, plan_url: str = "#"):
    """
    Send plan upgrade confirmation email using Celery.
    
    Args:
        to: Recipient email address
        user_name: User's name
        new_plan: Name of the upgraded plan
        amount: Prorated charge amount
        next_invoice_date: Next invoice date
        plan_url: URL to view plan details
    """
    task_name = "send_plan_upgrade_confirmation_email"
    
    # Validate email address before proceeding
    if not _validate_email_address(to):
        error_msg = f"Invalid recipient email address: {to}. Skipping retries."
        logger.error(f"❌ {error_msg}")
        raise Exception(error_msg)
    
    try:
        logger.info(f"📧 Starting {task_name} for {to}")
        
        import asyncio
        loop = asyncio.new_event_loop()
        loop.run_until_complete(
            EmailService.send_plan_upgrade_confirmation_email(to, user_name, new_plan, amount, next_invoice_date, plan_url)
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



