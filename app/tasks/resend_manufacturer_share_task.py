"""
Background Celery task(s) for re-sending the manufacturer share email
(and optional SMS) for an existing ``DesignVariantManufacturerShare``.

These tasks are kept in a dedicated file (rather than appended to
``app/tasks/email_tasks.py``) to keep the task module focused and
avoid editing the very large existing email_tasks file.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from app.services.email_service import EmailService
from app.tasks.base import create_task

logger = logging.getLogger(__name__)


@create_task(name="resend_manufacturer_share_email", max_retries=3)
def resend_manufacturer_share_email(
    self,
    share_id: int,
    resend_by_user_id: int = None,
):
    """
    Background Celery task that re-sends the manufacturer share email
    (and the SMS when a phone number is on file) for a previously
    created ``DesignVariantManufacturerShare``.

    This task is designed to be dispatched from the
    ``POST /api/v2/design-variant/variants/{variant_id}/resend-manufacturer-emails``
    endpoint. It looks up the share, the design variant, the design,
    the manufacturer, and the originating retailer, then re-sends the
    same email (and optional SMS) used when the share was first created.

    All database I/O is performed in a fresh ``SessionLocal`` because
    the task runs outside of the request's session lifecycle.
    """
    task_name = "resend_manufacturer_share_email"
    db = None
    resend_log_id = None

    try:
        logger.info(
            f"📧 Starting {task_name} for share_id={share_id} "
            f"(resend_by_user_id={resend_by_user_id})"
        )

        # Imports performed inside the task to avoid circular imports
        # at app startup time (mirrors the pattern used by other tasks).
        from app.core.database import SessionLocal
        from app.models.design import (
            Design,
            DesignVariant,
            DesignVariantManufacturerShare,
        )
        from app.models.email_log import EmailLog, EmailStatus
        from app.models.user import User
        from app.repositories.brand_setting import BrandSettingRepository
        from app.repositories.manufacturer import ManufacturerRepository
        from app.services.manufacturer_variant_share_service import (
            DesignVariantManufacturerShareService,
        )

        db = SessionLocal()
        retry_count = getattr(self.request, "retries", 0)

        # ── 1. Load the share record ──────────────────────────────────
        share = (
            db.query(DesignVariantManufacturerShare)
            .filter(DesignVariantManufacturerShare.id == share_id)
            .first()
        )
        if share is None:
            logger.warning(
                f"⚠️ {task_name}: share_id={share_id} not found, skipping."
            )
            return False

        # ── 2. Load the related variant / design ──────────────────────
        variant = (
            db.query(DesignVariant)
            .filter(DesignVariant.id == share.design_variant_id)
            .first()
        )
        if variant is None:
            logger.warning(
                f"⚠️ {task_name}: variant for share_id={share_id} not found."
            )
            return False

        design = db.query(Design).filter(Design.id == variant.design_id).first()
        if design is None:
            logger.warning(
                f"⚠️ {task_name}: design for share_id={share_id} not found."
            )
            return False

        # ── 3. Load the manufacturer ─────────────────────────────────
        manufacturer_repo = ManufacturerRepository(db)
        manufacturer = manufacturer_repo.get_by_id(share.manufacturer_id)
        if manufacturer is None or not manufacturer.is_active:
            logger.warning(
                f"⚠️ {task_name}: manufacturer for share_id={share_id} "
                f"missing or inactive."
            )
            return False

        # ── 4. Resolve the originating retailer (design owner) ────────
        owner = db.query(User).filter(User.id == design.user_id).first()
        if owner is None:
            logger.warning(
                f"⚠️ {task_name}: design owner for share_id={share_id} not found."
            )
            return False

        brand_repo = BrandSettingRepository(db)
        brand_setting = brand_repo.get_by_user_id(owner.id)
        retailer_name = (
            brand_setting.brand_name
            if brand_setting and brand_setting.brand_name
            else (owner.full_name or owner.username)
        )
        retailer_phone = (
            brand_setting.phone_number if brand_setting else owner.whatsapp_number
        )
        retailer_email = (
            brand_setting.business_email if brand_setting else owner.email
        )

        # ── 5. Build the review URL exactly like the original share flow
        share_service = DesignVariantManufacturerShareService(db)
        review_url = share_service.build_review_url(share)
        if not review_url:
            logger.warning(
                f"⚠️ {task_name}: could not build review_url for share_id={share_id}."
            )
            return False

        # ── 6. Use the stored email from the share record ──────────────
        primary_email = share.sent_to_email
        if not primary_email:
            # Fallback to manufacturer's first email if not stored
            if hasattr(manufacturer, "emails") and manufacturer.emails:
                try:
                    emails_data = json.loads(manufacturer.emails)
                    if isinstance(emails_data, list) and len(emails_data) > 0:
                        primary_email = (
                            emails_data[0].get("email")
                            if isinstance(emails_data[0], dict)
                            else emails_data[0]
                        )
                    elif isinstance(emails_data, dict):
                        primary_email = emails_data.get("email")
                    else:
                        primary_email = str(emails_data)
                except (json.JSONDecodeError, TypeError, AttributeError):
                    primary_email = str(manufacturer.emails).split(",")[0].strip()

        render_image_url = variant.base_design_image_url or ""
        jewelry_type = design.jewellery_type or "Custom Jewelry"
        metal = share.shared_metal or "Not specified"
        designer_name = owner.full_name or owner.username
        design_code = design.design_code
        
        # Determine brand logo based on subscription plan feature flag
        brand_logo_url = None
        from app.models.subscription import SubscriptionPlan
        plan_obj = None
        if hasattr(owner, 'subscriptions') and owner.subscriptions:
            active_sub = owner.subscriptions[0] if owner.subscriptions else None
            if active_sub and active_sub.plan_id:
                plan_obj = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == active_sub.plan_id).first()
        if plan_obj and plan_obj.can_use_logo:
            brand_logo_url = brand_setting.logo_url if brand_setting else None

        # ── 7. Log the resend in the email_logs table for traceability
        resend_log = EmailLog(
            to_email=primary_email or "unknown",
            template_name="manufacturer_design_share_resend",
            subject=f"[Resend] Quote Request from {designer_name} - Craftmen",
            template_variables=json.dumps({
                "share_id": share.id,
                "variant_id": variant.id,
                "design_id": design.id,
                "manufacturer_id": manufacturer.id,
                "resend_by_user_id": resend_by_user_id,
                "review_url": review_url,
            }),
            status=EmailStatus.PENDING,
            retry_count=retry_count,
            user_id=resend_by_user_id,
        )
        db.add(resend_log)
        db.commit()
        db.refresh(resend_log)
        resend_log_id = str(resend_log.id)

        # ── 8. Re-dispatch the actual email send ──────────────────────
        if primary_email:
            import asyncio
            loop = asyncio.new_event_loop()
            try:
                loop.run_until_complete(
                    EmailService.send_manufacturer_share(
                        to_email=primary_email,
                        manufacturer_name=manufacturer.name,
                        preview_url=review_url,
                        designer_name=designer_name,
                        retailer_name=retailer_name,
                        render_image_url=render_image_url,
                        design_code=design_code,
                        jewelry_type=jewelry_type,
                        metal=metal,
                        brand_logo_url=brand_logo_url,
                    )
                )
            finally:
                loop.close()

            resend_log = (
                db.query(EmailLog)
                .filter(EmailLog.id == resend_log_id)
                .first()
            )
            if resend_log:
                resend_log.status = EmailStatus.SENT
                resend_log.retry_count = retry_count
                resend_log.error_message = None
                resend_log.smtp_response = "Resent successfully via ZeptoMail"
                resend_log.sent_at = datetime.now(timezone.utc)
                db.commit()
        else:
            logger.warning(
                f"⚠️ {task_name}: manufacturer id={manufacturer.id} has no email; "
                f"skipping email portion for share_id={share_id}."
            )

        # ── 9. Optionally re-dispatch the SMS when a phone is on file ─
        if hasattr(manufacturer, "phone_number") and manufacturer.phone_number:
            try:
                from app.services.sms_service import sms_service
                from app.services.template_renderer import render_template_sync
                from bs4 import BeautifulSoup

                if sms_service.is_configured():
                    context = {
                        "retailer_name": retailer_name or designer_name,
                        "design_number": design_code or "",
                        "details_sheet_url": review_url,
                        "retailer_phone": retailer_phone or "",
                        "retailer_email": retailer_email or "",
                        "retailer_address": "",
                        "render_url": render_image_url or ""
                    }
                    rendered_html = render_template_sync(
                        "manufacturer_sms_design_share", context
                    )
                    soup = BeautifulSoup(rendered_html, "html.parser")
                    sms_text_element = soup.find(class_="sms-text")
                    if sms_text_element:
                        message = sms_text_element.get_text(
                            separator=" ", strip=True
                        )
                        message = message.replace(
                            "craftsmanai.app/manu/manufacturer/", ""
                        ).strip()
                        message = (
                            f"Reminder: New quote request from "
                            f"{retailer_name or designer_name}: "
                            f"{design_code or ''}. View the Details Sheet and "
                            f"submit costing here: {review_url}"
                        )
                    else:
                        message = (
                            f"Hi {manufacturer.name}, {designer_name} has "
                            f"resent the shared design variant for your "
                            f"quote! View it here: {review_url}"
                        )
                    sms_service.send_sms(
                        to_number=manufacturer.phone_number, message=message, media_url=render_image_url
                    )
            except Exception as sms_exc:
                # SMS failures should not fail the email resend
                logger.warning(
                    f"⚠️ {task_name}: SMS resend failed for share_id={share_id}: "
                    f"{sms_exc}"
                )

        # ── 10. Record an activity log entry ─────────────────────────
        try:
            from app.repositories.activity_log import (
                DesignActivityLogRepository,
            )
            activity_repo = DesignActivityLogRepository(db)
            activity_repo.log(
                design_id=design.id,
                user_id=resend_by_user_id,
                action_type="MANUFACTURER_SHARE_EMAIL_RESENT",
                message=(
                    f"Resent manufacturer share email for variant "
                    f"{variant.variant_name} to manufacturer "
                    f"{manufacturer.name}"
                ),
                metadata={
                    "variant_id": variant.id,
                    "manufacturer_id": manufacturer.id,
                    "share_id": share.id,
                    "review_url": review_url,
                },
            )
        except Exception as act_exc:
            logger.warning(
                f"⚠️ {task_name}: activity log write failed: {act_exc}"
            )

        logger.info(
            f"✅ {task_name} completed successfully for share_id={share_id}"
        )
        return True

    except Exception as exc:
        logger.error(
            f"❌ {task_name} failed for share_id={share_id}: {str(exc)}"
        )

        try:
            if db and resend_log_id:
                resend_log = (
                    db.query(EmailLog)
                    .filter(EmailLog.id == resend_log_id)
                    .first()
                )
                if resend_log:
                    retry_count = getattr(self.request, "retries", 0) + 1
                    resend_log.retry_count = retry_count
                    resend_log.error_message = str(exc)
                    if getattr(self.request, "retries", 0) >= self.max_retries:
                        resend_log.status = EmailStatus.FAILED
                        resend_log.smtp_response = str(exc)
                    else:
                        resend_log.status = EmailStatus.RETRYING
                        resend_log.smtp_response = str(exc)
                    db.commit()
        except Exception as log_exc:
            logger.error(f"Failed to update resend email log: {str(log_exc)}")

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3,
        )
    finally:
        try:
            if db:
                db.close()
        except Exception:
            pass
