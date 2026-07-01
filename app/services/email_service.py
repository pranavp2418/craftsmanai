import logging
import json
from typing import Optional
from app.core.config import settings
from app.services.template_renderer import render_template
import httpx

logger = logging.getLogger(__name__)


class EmailService:
    """Email service for sending OTPs and notifications via ZeptoMail API"""
    
    @staticmethod
    def _create_email_log(to_email: str, template_name: str, subject: str, variables: dict) -> Optional[str]:
        """Create a pending email log in the database and return the log ID"""
        from app.core.database import SessionLocal
        from app.models.email_log import EmailLog, EmailStatus
        from app.models.user import User
        
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
    async def _send_via_zeptomail(
        to_email: str,
        subject: str,
        html_content: str,
        text_body: str,
        from_email: Optional[str] = None
    ) -> dict:
        """
        Send email via ZeptoMail REST API
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML body content
            text_body: Plain text body content
            from_email: Optional override sender email (defaults to ZEPTOMAIL_FROM_EMAIL)
        
        Returns:
            dict with keys: success (bool), message (str), data (dict)
        """
        if not settings.ZEPTOMAIL_API_KEY:
            raise ValueError("ZEPTOMAIL_API_KEY is not configured")
        
        api_url = settings.ZEPTOMAIL_API_URL
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
            "textbody": text_body
        }
        
        if settings.ZEPTOMAIL_BOUNCE_ADDRESS:
            payload["bounce_address"] = settings.ZEPTOMAIL_BOUNCE_ADDRESS
        
        headers = {
            "Authorization": f"Zoho-enczapikey {settings.ZEPTOMAIL_API_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                api_url,
                json=payload,
                headers=headers
            )
            
            if response.status_code in (200, 201, 202):
                return {
                    "success": True,
                    "message": "Email sent successfully via ZeptoMail",
                    "data": response.json()
                }
            else:
                error_detail = f"ZeptoMail API error: {response.status_code} - {response.text}"
                logger.error(error_detail)
                return {
                    "success": False,
                    "message": error_detail,
                    "data": None
                }
    
    @staticmethod
    async def send_signup_otp(to: str, otp: str, user_name: str, expires_minutes: int = 15, verify_url: str = "#"):
        """Send signup OTP email"""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="signup_otp",
            subject="Verify your email address - Craftsman AI",
            variables={"otp": otp, "user_name": user_name, "expires_minutes": expires_minutes, "verify_url": verify_url}
        )
        try:
            logger.info(f"SENDING EMAIL: To={to}, OTP={otp}, User={user_name}")
            
            subject = "Verify your email address - Craftsman AI"
            
            # Render template using Jinja2
            html_content = await render_template(
                "signup_otp",
                context={
                    "user_name": user_name,
                    "code": otp,
                    "expires_minutes": expires_minutes,
                    "verify_url": verify_url
                }
            )
            
            text_body = f"Hi {user_name},\n\nYour OTP code is: {otp}\n\nBest regards,\nThe Craftsman AI Team"
            
            result = await EmailService._send_via_zeptomail(
                to_email=to,
                subject=subject,
                html_content=html_content,
                text_body=text_body
            )
            
            if result["success"]:
                logger.info(f"Successfully sent signup OTP email to {to}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
            
        except Exception as e:
            logger.error(f"Failed to send signup OTP to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e
    
    @staticmethod
    async def send_password_reset_otp(to: str, otp: str, user_name: str, expires_minutes: int = 10, reset_url: str = "#"):
        """Send password reset OTP email"""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="password_reset_otp",
            subject="Reset your password - Craftsman AI",
            variables={"otp": otp, "user_name": user_name, "expires_minutes": expires_minutes, "reset_url": reset_url}
        )
        try:
            logger.info(f"SENDING PASSWORD RESET EMAIL: To={to}, OTP={otp}, User={user_name}")
            
            subject = "Reset your password - Craftsman AI"
            
            # Render template using Jinja2
            html_content = await render_template(
                "password_reset_otp",
                context={
                    "user_name": user_name,
                    "code": otp,
                    "expires_minutes": expires_minutes,
                    "reset_url": reset_url
                }
            )
            
            text_body = f"Hi {user_name},\n\nYour security code is: {otp}\n\nBest regards,\nThe Craftsman AI Team"
            
            result = await EmailService._send_via_zeptomail(
                to_email=to,
                subject=subject,
                html_content=html_content,
                text_body=text_body
            )
            
            if result["success"]:
                logger.info(f"Successfully sent password reset OTP email to {to}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
            
        except Exception as e:
            logger.error(f"Failed to send password reset OTP to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e
    
    @staticmethod
    async def send_customer_share(to_email: str, customer_name: str, preview_url: str, designer_name: str, retailer_name: str = None, render_image_url: str = None, design_code: str = None, jewelry_type: str = None, version: str = None, version_label: str = None, brand_logo_url: str = None, brand_primary_color: str = None):
        """Send an email to a customer with a link to review a shared design using customer_approval template."""
        from app.models.email_log import EmailStatus
        
        log_id = EmailService._create_email_log(
            to_email=to_email,
            template_name="customer_approval",
            subject=f"{designer_name} shared a design with you - Craftsman AI",
            variables={"customer_name": customer_name, "preview_url": preview_url, "designer_name": designer_name, "retailer_name": retailer_name, "render_image_url": render_image_url, "design_code": design_code, "jewelry_type": jewelry_type, "version": version, "version_label": version_label, "brand_logo_url": brand_logo_url, "brand_primary_color": brand_primary_color}
        )
        try:
            logger.info(f"SENDING CUSTOMER SHARE EMAIL: To={to_email}, URL={preview_url}")
            
            subject = f"{designer_name} shared a design with you - Craftsman AI"
            
            # Render the customer_approval template
            context = {
                "retailer_name": retailer_name or designer_name,
                "render_image_url": render_image_url or "",
                "version_name": version or "v1.0",
                "design_number": design_code or "",
                "jewelry_type": jewelry_type or "Custom Jewelry",
                "version_label": version_label or "Version 1",
                "approval_url": preview_url,
                "brand_logo_url": brand_logo_url or "",
                "brand_primary_color": brand_primary_color or "#6366F1"
            }
            
            html_content = await render_template("customer_approval", context)
            
            text_body = f"Hi {customer_name},\n\n{retailer_name or designer_name} has shared a custom jewelry design with you.\n\nDesign Number: {design_code or 'N/A'}\nJewelry Type: {jewelry_type or 'Custom Jewelry'}\nVersion: {version or 'v1.0'}\n\nReview it here: {preview_url}\n\nBest regards,\nThe Craftsman AI Team"
            
            # Customer design share emails use ZEPTOMAIL_CUSTOMER_EMAIL
            result = await EmailService._send_via_zeptomail(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_body=text_body,
                from_email=settings.ZEPTOMAIL_CUSTOMER_EMAIL
            )
            
            if result["success"]:
                logger.info(f"Successfully sent customer share email to {to_email}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
                
        except Exception as e:
            logger.error(f"Failed to send customer share email to {to_email}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e

    @staticmethod
    async def send_manufacturer_share(to_email: str, manufacturer_name: str, preview_url: str, designer_name: str, retailer_name: str = None, render_image_url: str = None, design_code: str = None, jewelry_type: str = None, metal: str = None, brand_logo_url: str = None, brand_primary_color: str = None):
        """Send an email to a manufacturer with a link to review a shared design for quote using manufacturer_design_share template."""
        from app.models.email_log import EmailStatus
        
        log_id = EmailService._create_email_log(
            to_email=to_email,
            template_name="manufacturer_design_share",
            subject=f"Quote Request from {designer_name} - Craftsman AI",
            variables={"manufacturer_name": manufacturer_name, "preview_url": preview_url, "designer_name": designer_name, "retailer_name": retailer_name, "render_image_url": render_image_url, "design_code": design_code, "jewelry_type": jewelry_type, "metal": metal, "brand_logo_url": brand_logo_url, "brand_primary_color": brand_primary_color}
        )
        try:
            logger.info(f"SENDING MANUFACTURER SHARE EMAIL: To={to_email}, URL={preview_url}")
            
            subject = f"Quote Request from {designer_name} - Craftsman AI"
            
            # Render the manufacturer_design_share template
            context = {
                "retailer_name": retailer_name or designer_name,
                "render_image_url": render_image_url or "",
                "design_number": design_code or "",
                "jewelry_type": jewelry_type or "Custom Jewelry",
                "metal_spec": metal or "Not specified",
                "details_sheet_url": preview_url,
                "brand_logo_url": brand_logo_url or "",
                "brand_primary_color": brand_primary_color or "#6366F1"
            }
            
            html_content = await render_template("manufacturer_design_share", context)
            
            text_body = f"Hi {manufacturer_name},\n\n{retailer_name or designer_name} sent a Details Sheet for manufacturer quote.\n\nDesign Number: {design_code or 'N/A'}\nJewelry Type: {jewelry_type or 'Custom Jewelry'}\nMetal: {metal or 'Not specified'}\n\nOpen the Details Sheet and submit costing here: {preview_url}\n\nBest regards,\nThe Craftsman AI Team"
            
            # Manufacturer quote emails use ZEPTOMAIL_QUOTES_EMAIL
            result = await EmailService._send_via_zeptomail(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_body=text_body,
                from_email=settings.ZEPTOMAIL_QUOTES_EMAIL
            )
            
            if result["success"]:
                logger.info(f"Successfully sent manufacturer share email to {to_email}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
                
        except Exception as e:
            logger.error(f"Failed to send manufacturer share email to {to_email}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e

    @staticmethod
    async def send_contact_notification(
        name: str,
        email: str,
        phone: str = None,
        subject: str = "",
        message: str = "",
    ):
        """Send a notification email when someone submits the contact form."""
        from app.models.email_log import EmailStatus

        to_email = settings.CONTACT_NOTIFICATION_EMAIL
        log_id = EmailService._create_email_log(
            to_email=to_email,
            template_name="contact_notification",
            subject=f"Contact Form: {subject}",
            variables={
                "name": name,
                "email": email,
                "phone": phone or "Not provided",
                "subject": subject,
                "message": message,
            },
        )
        try:
            logger.info(f"SENDING CONTACT NOTIFICATION: From={name} ({email}), Subject={subject}")

            email_subject = f"New Contact Form Submission: {subject} - Craftsman AI"

            html_content = f"""
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #1a1a2e;">New Contact Form Submission</h2>
                <hr style="border: 1px solid #eee;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; font-weight: bold; width: 120px; color: #555;">Name:</td>
                        <td style="padding: 10px;">{name}</td>
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
                        <td style="padding: 10px; font-weight: bold; color: #555;">Subject:</td>
                        <td style="padding: 10px;">{subject}</td>
                    </tr>
                </table>
                <hr style="border: 1px solid #eee;">
                <h3 style="color: #1a1a2e;">Message:</h3>
                <p style="padding: 10px; background-color: #f9f9f9; border-left: 4px solid #1a1a2e; line-height: 1.6;">
                    {message}
                </p>
                <hr style="border: 1px solid #eee;">
                <p style="color: #999; font-size: 12px;">
                    This email was sent from the Craftsman AI contact form.
                </p>
            </body>
            </html>
            """

            text_body = f"""
New Contact Form Submission

Name: {name}
Email: {email}
Phone: {phone or "Not provided"}
Subject: {subject}

Message:
{message}
            """.strip()

            result = await EmailService._send_via_zeptomail(
                to_email=to_email,
                subject=email_subject,
                html_content=html_content,
                text_body=text_body,
            )

            if result["success"]:
                logger.info(f"Successfully sent contact notification email to {to_email}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"],
                )
            else:
                raise Exception(result["message"])

        except Exception as e:
            logger.error(f"Failed to send contact notification email: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e),
            )
            raise e

    @staticmethod
    async def send_customer_action_email(
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
        comment: str = None,
    ):
        """
        Send an email to the retailer when a customer takes action on a shared design
        (approve, reject, or request refinement).
        Uses the customer_action_notification template.
        
        Args:
            to_email: Retailer's email address
            retailer_name: Retailer's brand/display name
            customer_name: Customer who took the action
            action: 'approved', 'rejected', or 'refinement_requested'
            design_name: Name of the design
            variant_name: Name of the variant
            design_code: Design code/number
            jewelry_type: Type of jewelry
            version: Version string
            version_label: Human-readable version label
            render_image_url: URL of the design render
            brand_logo_url: URL of the brand logo
            comment: Optional comment from the customer
        """
        from app.models.email_log import EmailStatus
        
        action_display = {
            "approved": "Approved",
            "rejected": "Rejected",
            "refinement_requested": "Requested Changes",
        }.get(action, action)
        
        subject = f"Customer {action_display}: {design_name or 'Design'} - Craftsman AI"
        
        log_id = EmailService._create_email_log(
            to_email=to_email,
            template_name="customer_action_notification",
            subject=subject,
            variables={
                "retailer_name": retailer_name,
                "customer_name": customer_name,
                "action": action,
                "design_name": design_name,
                "variant_name": variant_name,
                "design_code": design_code,
                "jewelry_type": jewelry_type,
                "version": version,
                "version_label": version_label,
                "render_image_url": render_image_url,
                "brand_logo_url": brand_logo_url,
                "comment": comment,
            }
        )
        try:
            logger.info(f"SENDING CUSTOMER ACTION EMAIL: To={to_email}, Action={action}, Customer={customer_name}")
            
            # Build context for the template
            context = {
                "action": action,
                "customer_name": customer_name,
                "design_name": design_name or "N/A",
                "variant_name": variant_name or "N/A",
                "render_image_url": render_image_url or "",
                "version": version or "v1.0",
                "design_number": design_code or "",
                "jewelry_type": jewelry_type or "Custom Jewelry",
                "version_label": version_label or "Version 1",
                "brand_logo_url": brand_logo_url or "",
                "comment": comment or "",
                "dashboard_url": "#",
            }
            
            html_content = await render_template("customer_action_notification", context)
            
            action_past_tense = {
                "approved": "approved",
                "rejected": "rejected",
                "refinement_requested": "requested changes to",
            }.get(action, "taken action on")
            
            text_body = (
                f"Hi {retailer_name},\n\n"
                f"Your customer {customer_name} has {action_past_tense} the design.\n\n"
                f"Design: {design_name or 'N/A'} ({variant_name or 'N/A'})\n"
                f"Design Code: {design_code or 'N/A'}\n"
                f"Jewelry Type: {jewelry_type or 'Custom Jewelry'}\n"
                f"Version: {version or 'v1.0'}\n"
                + (f"\nCustomer's note: {comment}\n" if comment else "")
                + "\nCheck the design in your Craftsman AI dashboard for more details.\n\n"
                "Best regards,\nThe Craftsman AI Team"
            )
            
            result = await EmailService._send_via_zeptomail(
                to_email=to_email,
                subject=subject,
                html_content=html_content,
                text_body=text_body
            )
            
            if result["success"]:
                logger.info(f"Successfully sent customer action email to {to_email}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
                
        except Exception as e:
            logger.error(f"Failed to send customer action email to {to_email}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e

    @staticmethod
    async def send_welcome_email(to: str, user_name: str, dashboard_url: str = "#"):
        """Send welcome email after successful verification"""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="welcome_platform",
            subject="Welcome to Craftsman AI!",
            variables={"user_name": user_name, "dashboard_url": dashboard_url}
        )
        try:
            logger.info(f"SENDING WELCOME EMAIL: To={to}, User={user_name}")
            
            subject = "Welcome to Craftsman AI!"
            
            # Render template using Jinja2
            html_content = await render_template(
                "welcome_platform",
                context={
                    "dashboard_url": dashboard_url
                }
            )
            
            text_body = f"Hi {user_name},\n\nWelcome to Craftsman AI! Your email address has been successfully verified.\n\nBest regards,\nThe Craftsman AI Team"
            
            result = await EmailService._send_via_zeptomail(
                to_email=to,
                subject=subject,
                html_content=html_content,
                text_body=text_body
            )
            
            if result["success"]:
                logger.info(f"Successfully sent welcome email to {to}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
            
        except Exception as e:
            logger.error(f"Failed to send welcome email to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e

    @staticmethod
    async def send_plan_purchase_confirmation_email(to: str, user_name: str, plan_name: str, amount: str, billing_date: str, billing_url: str = "#"):
        """Send plan purchase confirmation email using plan_purchase_confirm_email_template."""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="plan_purchase_confirm_email_template/purchase_confirmed",
            subject="Purchase confirmed — your CraftsmanAI plan is active",
            variables={"user_name": user_name, "plan_name": plan_name, "amount": amount, "billing_date": billing_date, "billing_url": billing_url}
        )
        try:
            logger.info(f"SENDING PLAN PURCHASE CONFIRMATION: To={to}, Plan={plan_name}")
            
            subject = "Purchase confirmed — your CraftsmanAI plan is active"
            
            html_content = await render_template(
                "plan_purchase_confirm_email_template/purchase_confirmed",
                context={
                    "user_name": user_name,
                    "plan_name": plan_name,
                    "amount": amount,
                    "billing_date": billing_date,
                    "billing_url": billing_url
                }
            )
            
            text_body = f"Hi {user_name},\n\nYour {plan_name} plan is now active.\n\nPlan: {plan_name}\nAmount: {amount}\nBilling Date: {billing_date}\nStatus: Active\n\nView billing details: {billing_url}\n\nBest regards,\nThe Craftsman AI Team"
            
            result = await EmailService._send_via_zeptomail(
                to_email=to,
                subject=subject,
                html_content=html_content,
                text_body=text_body
            )
            
            if result["success"]:
                logger.info(f"Successfully sent plan purchase confirmation to {to}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
            
        except Exception as e:
            logger.error(f"Failed to send plan purchase confirmation to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e

    @staticmethod
    async def send_topup_purchase_confirmation_email(to: str, user_name: str, plan_name: str, amount: str, billing_date: str, billing_url: str = "#"):
        """Send top-up pack purchase confirmation email using plan_purchase_confirm_email_template."""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="plan_purchase_confirm_email_template/purchase_confirmed",
            subject="Top-up pack confirmed — your CraftsmanAI plan is updated",
            variables={"user_name": user_name, "plan_name": plan_name, "amount": amount, "billing_date": billing_date, "billing_url": billing_url}
        )
        try:
            logger.info(f"SENDING TOP-UP PURCHASE CONFIRMATION: To={to}, Plan={plan_name}")
            
            subject = "Top-up pack confirmed — your CraftsmanAI plan is updated"
            
            html_content = await render_template(
                "plan_purchase_confirm_email_template/purchase_confirmed",
                context={
                    "user_name": user_name,
                    "plan_name": plan_name,
                    "amount": amount,
                    "billing_date": billing_date,
                    "billing_url": billing_url
                }
            )
            
            text_body = f"Hi {user_name},\n\nYour {plan_name} top-up pack is now active.\n\nPlan: {plan_name}\nAmount: {amount}\nBilling Date: {billing_date}\nStatus: Active\n\nView billing details: {billing_url}\n\nBest regards,\nThe Craftsman AI Team"
            
            result = await EmailService._send_via_zeptomail(
                to_email=to,
                subject=subject,
                html_content=html_content,
                text_body=text_body
            )
            
            if result["success"]:
                logger.info(f"Successfully sent top-up purchase confirmation to {to}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
            
        except Exception as e:
            logger.error(f"Failed to send top-up purchase confirmation to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e

    @staticmethod
    async def send_plan_upgrade_confirmation_email(to: str, user_name: str, new_plan: str, amount: str, next_invoice_date: str, plan_url: str = "#"):
        """Send plan upgrade confirmation email using plan_upgrade_email_template."""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="plan_upgrade_email_template/plan_upgraded",
            subject="Your CraftsmanAI plan was upgraded",
            variables={"user_name": user_name, "new_plan": new_plan, "amount": amount, "next_invoice_date": next_invoice_date, "plan_url": plan_url}
        )
        try:
            logger.info(f"SENDING PLAN UPGRADE CONFIRMATION: To={to}, New Plan={new_plan}")
            
            subject = "Your CraftsmanAI plan was upgraded"
            
            html_content = await render_template(
                "plan_upgrade_email_template/plan_upgraded",
                context={
                    "user_name": user_name,
                    "new_plan": new_plan,
                    "amount": amount,
                    "next_invoice_date": next_invoice_date,
                    "plan_url": plan_url
                }
            )
            
            text_body = f"Hi {user_name},\n\nYour CraftsmanAI plan has been upgraded to {new_plan}.\n\nNew Plan: {new_plan}\nProrated Charge: {amount}\nNext Invoice Date: {next_invoice_date}\nStatus: Updated\n\nView Plan: {plan_url}\n\nBest regards,\nThe Craftsman AI Team"
            
            result = await EmailService._send_via_zeptomail(
                to_email=to,
                subject=subject,
                html_content=html_content,
                text_body=text_body
            )
            
            if result["success"]:
                logger.info(f"Successfully sent plan upgrade confirmation to {to}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
            
        except Exception as e:
            logger.error(f"Failed to send plan upgrade confirmation to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e

    @staticmethod
    async def send_subscription_renewal_confirmation(to: str, user_name: str, plan_name: str, amount: str, next_renewal_date: str, invoice_url: str = "#"):
        """Send subscription renewal confirmation email using subscription_cancelled_email_template."""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="subscription_renewed_email_template/subscription_renewed",
            subject="Your CraftsmanAI subscription renewed",
            variables={"user_name": user_name, "plan_name": plan_name, "amount": amount, "next_renewal_date": next_renewal_date, "invoice_url": invoice_url}
        )
        try:
            logger.info(f"SENDING SUBSCRIPTION RENEWAL: To={to}, Plan={plan_name}")
            
            subject = "Your CraftsmanAI subscription renewed"
            
            html_content = await render_template(
                "subscription_renewed_email_template/subscription_renewed",
                context={
                    "user_name": user_name,
                    "plan_name": plan_name,
                    "amount": amount,
                    "next_renewal_date": next_renewal_date,
                    "invoice_url": invoice_url
                }
            )
            
            text_body = f"Hi {user_name},\n\nYour {plan_name} plan has renewed successfully.\n\nPlan: {plan_name}\nRenewal Amount: {amount}\nNext Renewal: {next_renewal_date}\nStatus: Renewed\n\nView Invoice: {invoice_url}\n\nBest regards,\nThe Craftsman AI Team"
            
            result = await EmailService._send_via_zeptomail(
                to_email=to,
                subject=subject,
                html_content=html_content,
                text_body=text_body
            )
            
            if result["success"]:
                logger.info(f"Successfully sent subscription renewal confirmation to {to}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
            
        except Exception as e:
            logger.error(f"Failed to send subscription renewal confirmation to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e

    @staticmethod
    async def send_subscription_cancellation_confirmation(to: str, user_name: str, plan_name: str, access_end_date: str, cancellation_date: str, manage_billing_url: str = "#"):
        """Send subscription cancellation confirmation email using subscription_renewed_email_template."""
        from app.models.email_log import EmailStatus
        log_id = EmailService._create_email_log(
            to_email=to,
            template_name="subscription_cancelled_email_template/subscription_cancelled",
            subject="Your CraftsmanAI subscription has been cancelled",
            variables={"user_name": user_name, "plan_name": plan_name, "access_end_date": access_end_date, "cancellation_date": cancellation_date, "manage_billing_url": manage_billing_url}
        )
        try:
            logger.info(f"SENDING SUBSCRIPTION CANCELLATION: To={to}, Plan={plan_name}")
            
            subject = "Your CraftsmanAI subscription has been cancelled"
            
            html_content = await render_template(
                "subscription_cancelled_email_template/subscription_cancelled",
                context={
                    "user_name": user_name,
                    "plan_name": plan_name,
                    "access_end_date": access_end_date,
                    "cancellation_date": cancellation_date,
                    "manage_billing_url": manage_billing_url
                }
            )
            
            text_body = f"Hi {user_name},\n\nYour {plan_name} subscription has been cancelled.\n\nPlan: {plan_name}\nAccess Until: {access_end_date}\nCancellation Date: {cancellation_date}\nStatus: Cancelled\n\nYou can manage your billing here: {manage_billing_url}\n\nBest regards,\nThe Craftsman AI Team"
            
            result = await EmailService._send_via_zeptomail(
                to_email=to,
                subject=subject,
                html_content=html_content,
                text_body=text_body
            )
            
            if result["success"]:
                logger.info(f"Successfully sent subscription cancellation confirmation to {to}")
                EmailService._update_email_log_status(
                    log_id=log_id,
                    status=EmailStatus.SENT,
                    smtp_response=result["message"]
                )
            else:
                raise Exception(result["message"])
            
        except Exception as e:
            logger.error(f"Failed to send subscription cancellation confirmation to {to}: {str(e)}")
            EmailService._update_email_log_status(
                log_id=log_id,
                status=EmailStatus.FAILED,
                error_message=str(e)
            )
            raise e
