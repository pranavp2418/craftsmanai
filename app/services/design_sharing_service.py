import logging
import secrets
import time
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.models.design import Design, DesignShare, DesignShareStatus, DesignStatus
from app.repositories.customer import CustomerRepository
from app.repositories.design import DesignRepository
from app.repositories.design_share import DesignShareRepository
from app.repositories.activity_log import DesignActivityLogRepository
from app.repositories.design_variant import DesignVariantRepository


class DesignSharingService:
    def __init__(self, db: Session):
        self.db = db
        self.share_repo = DesignShareRepository(db)
        self.activity_repo = DesignActivityLogRepository(db)
        self.variant_repo = DesignVariantRepository(db)
        self.customer_repo = CustomerRepository(db)

    def _token(self) -> str:
        return secrets.token_urlsafe(18)

    def create_share(
        self,
        *,
        design_variant_id: int,
        customer_id: Optional[int] = None,
        comment: Optional[str] = None,
        shared_metal: Optional[str] = None,
        shared_angles: Optional[list[str]] = None,
        require_approval: bool = False,
        allow_feedback: bool = True,
        allow_review_request: bool = True
    ) -> DesignShare:
        variant = self.variant_repo.get_by_id(design_variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {design_variant_id} not found")

        # Defense-in-depth: verify the customer exists and belongs to the same user as the design
        if customer_id is not None:
            customer = self.customer_repo.get_by_id(customer_id)
            if not customer:
                raise ValueError(f"Customer with id {customer_id} not found")
            if not customer.is_active:
                raise ValueError("Invalid customer")

        # Check if the design is already shared with another customer
        if customer_id is not None:
            customer_shares = self.share_repo.get_customer_shares_for_design(variant.design_id)
            for customer_share in customer_shares:
                if customer_share.customer_id != customer_id:
                    raise ValueError("Design is already shared with another customer.")

        # If this variant has already been shared, return the existing share
        # to reuse the same public_token instead of generating a new one.
        existing_shares = self.share_repo.list_for_design_variant(design_variant_id)
        if existing_shares:
            if existing_shares[0].status == DesignShareStatus.REJECTED:
                raise ValueError("Design already rejected by customer")
            # Security check: only return existing share if it's for the same customer
            if customer_id is not None and existing_shares[0].customer_id != customer_id:
                raise ValueError("This variant is already shared with another customer.")
            
            existing_share = existing_shares[0]
            existing_share.shared_metal = shared_metal
            existing_share.shared_angles = shared_angles
            existing_share.comment = comment
            self.db.add(existing_share)
            self.db.commit()
            self.db.refresh(existing_share)

            self.activity_repo.log(
                design_id=variant.design_id,
                action_type="DESIGN_SHARED_UPDATED",
                message=f"Design share updated for external stakeholder"
                        f"{f' (metal: {shared_metal})' if shared_metal else ''}",
                metadata={"share_id": existing_share.id, "variant_id": design_variant_id, "customer_id": customer_id, "shared_metal": shared_metal, "shared_angles": shared_angles},
            )
            return existing_share

        # Check if any variant of this design has already been shared
        all_design_shares = self.share_repo.get_customer_shares_for_design(variant.design_id)
        if all_design_shares:
            raise ValueError("This design already has a shared variant.")

        share = self.share_repo.create_share(
            design_variant_id=design_variant_id,
            customer_id=customer_id,
            public_token=self._token(),
            comment=comment,
            shared_metal=shared_metal,
            shared_angles=shared_angles,
        )
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="DESIGN_SHARED",
            message=f"Design shared with external stakeholder"
                    f"{f' (metal: {shared_metal})' if shared_metal else ''}",
            metadata={"share_id": share.id, "variant_id": design_variant_id, "customer_id": customer_id, "shared_metal": shared_metal, "shared_angles": shared_angles},
        )
        return share

    def get_share(self, share_id: int) -> Optional[DesignShare]:
        return self.share_repo.get_by_id(share_id)

    def get_by_token(self, token: str) -> Optional[DesignShare]:
        return self.share_repo.get_by_token(token)

    def update_variant(
        self,
        share: DesignShare,
        *,
        design_variant_id: int,
    ) -> DesignShare:
        """Update which variant the share points to (after refinement)."""
        variant = self.variant_repo.get_by_id(design_variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {design_variant_id} not found")

        updated = self.share_repo.update_variant(share, design_variant_id=design_variant_id)

        # Put the share back to PENDING so the customer reviews the new variant
        if share.status == DesignShareStatus.NEEDS_REFINEMENT:
            self.share_repo.update_status(
                share,
                status=DesignShareStatus.PENDING,
                comment="Variant updated after refinement, pending customer review",
            )

        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="VARIANT_UPDATED_ON_SHARE",
            message=f"Share {share.id} updated to variant {design_variant_id}",
            metadata={"share_id": share.id, "new_variant_id": design_variant_id},
        )
        return updated

    def update_status(
        self,
        share: DesignShare,
        *,
        status: DesignShareStatus,
        comment: Optional[str] = None,
    ) -> DesignShare:
        updated = self.share_repo.update_status(share, status=status, comment=comment)
        action = {
            DesignShareStatus.ACCEPTED: "CUSTOMER_APPROVED",
            DesignShareStatus.REJECTED: "CUSTOMER_REJECTED",
            DesignShareStatus.NEEDS_REFINEMENT: "NEEDS_REFINEMENT",
            DesignShareStatus.PENDING: "DESIGN_SHARED",
        }[status]
        # Get the variant's design_id for activity logging
        variant = share.design_variant
        design_id = variant.design_id if variant else None
        self.activity_repo.log(
            design_id=design_id,
            action_type=action,
            message=comment,
            metadata={"share_id": share.id, "variant_id": share.design_variant_id, "status": status.value},
        )

        # Sync the parent Design status with the customer's decision
        if variant and variant.design:
            design = variant.design
            design_repo = DesignRepository(self.db)
            if status == DesignShareStatus.ACCEPTED:
                design_repo.update_design(design, status=DesignStatus.APPROVED)
            elif status == DesignShareStatus.REJECTED:
                design_repo.update_design(design, status=DesignStatus.DESIGN_REJECTED)
            elif status == DesignShareStatus.NEEDS_REFINEMENT:
                design_repo.update_design(design, status=DesignStatus.REFINEMENT_REQUESTED)

        # Trigger notification to the retailer (the user who created this customer or design)
        recipient_user_id = None
        if share.customer:
            recipient_user_id = share.customer.created_by_user_id
        if not recipient_user_id and variant and variant.design:
            recipient_user_id = variant.design.user_id

        if recipient_user_id:
            try:
                from app.services.notification_service import NotificationService
                notification_service = NotificationService(self.db)
                
                customer_name = share.customer.full_name if share.customer else "A customer"
                design_name = variant.design.name if (variant and variant.design and variant.design.name) else (variant.design.design_code if (variant and variant.design) else "design")
                variant_name = variant.variant_name if variant else ""
                
                notification_title = ""
                notification_message = ""
                notification_type = "general"
                
                if status == DesignShareStatus.ACCEPTED:
                    notification_title = "Design Approved"
                    notification_message = f"Customer '{customer_name}' approved variant '{variant_name}' of design '{design_name}'."
                    notification_type = "design_approved"
                elif status == DesignShareStatus.NEEDS_REFINEMENT:
                    notification_title = "Refinement Requested"
                    notification_message = f"Customer '{customer_name}' requested refinement on variant '{variant_name}' of design '{design_name}'."
                    if comment:
                        notification_message += f" Note: {comment}"
                    notification_type = "refinement_requested"
                elif status == DesignShareStatus.REJECTED:
                    notification_title = "Design Rejected"
                    notification_message = f"Customer '{customer_name}' rejected variant '{variant_name}' of design '{design_name}'."
                    if comment:
                        notification_message += f" Note: {comment}"
                    notification_type = "design_rejected"

                if notification_title and notification_message:
                    notification_service.send_notification(
                        user_id=recipient_user_id,
                        type=notification_type,
                        title=notification_title,
                        message=notification_message,
                        source="design_share",
                        reference_id=share.id,
                        data={
                            "share_id": share.id,
                            "design_id": design_id,
                            "variant_id": share.design_variant_id,
                            "status": status.value,
                        }
                    )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to send customer access notification: {str(e)}")

        # --- Web Push notification (if design_approval_alerts is enabled) ---
        if recipient_user_id:
            try:
                from app.models.notification_setting import NotificationSetting
                from app.services.webpush_service import WebPushService

                notif_setting = self.db.query(NotificationSetting).filter(
                    NotificationSetting.user_id == recipient_user_id
                ).first()

                if notif_setting and notif_setting.design_approval_alerts and notif_setting.push_notifications:
                    push_title = notification_title
                    push_body = notification_message

                    if push_title and push_body:
                        WebPushService.send_push(
                            db=self.db,
                            user_id=recipient_user_id,
                            title=push_title,
                            body=push_body,
                            url=f"/designs/{design_id}" if design_id else None,
                            data={
                                "share_id": share.id,
                                "design_id": design_id,
                                "variant_id": share.design_variant_id,
                                "status": status.value,
                                "type": "design_approval_alert",
                            },
                            tag=f"design-share-{share.id}-{status.value}-{int(time.time())}",
                        )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to send push notification: {str(e)}")

        # --- Email notification (if email_notifications is enabled) ---
        if recipient_user_id:
            try:
                from app.models.notification_setting import NotificationSetting
                from app.tasks.email_tasks import send_customer_action_email_task
                from app.repositories.brand_setting import BrandSettingRepository
                from app.models.user import User

                notif_setting = self.db.query(NotificationSetting).filter(
                    NotificationSetting.user_id == recipient_user_id
                ).first()

                if notif_setting and notif_setting.email_notifications and notif_setting.design_approval_alerts:
                    # Get recipient user's email
                    recipient_user = self.db.query(User).filter(User.id == recipient_user_id).first()
                    if recipient_user and recipient_user.email:
                        # Get brand settings for retailer name
                        brand_repo = BrandSettingRepository(self.db)
                        brand_setting = brand_repo.get_by_user_id(recipient_user_id)
                        retailer_name = brand_setting.brand_name if brand_setting else (recipient_user.full_name or recipient_user.username)
                        
                        # Map status to action string
                        action_map = {
                            DesignShareStatus.ACCEPTED: "approved",
                            DesignShareStatus.REJECTED: "rejected",
                            DesignShareStatus.NEEDS_REFINEMENT: "refinement_requested",
                        }
                        action = action_map.get(status)
                        
                        if action and notification_title:
                            send_customer_action_email_task.delay(
                                to_email=recipient_user.email,
                                retailer_name=retailer_name,
                                customer_name=customer_name,
                                action=action,
                                design_name=design_name,
                                variant_name=variant_name,
                                design_code=variant.design.design_code if (variant and variant.design) else None,
                                jewelry_type=variant.design.jewellery_type if (variant and variant.design) else None,
                                version=f"v{variant.version_number}" if variant and variant.version_number else None,
                                version_label=f"Version {variant.version_number}" if variant and variant.version_number else None,
                                render_image_url=variant.base_design_image_url if variant else None,
                                brand_logo_url=brand_setting.logo_url if brand_setting else None,
                                comment=comment,
                            )
                            logger.info(
                                "Customer action email queued: action=%s user_id=%s email=%s",
                                action, recipient_user_id, recipient_user.email,
                            )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to send customer action email: {str(e)}")

        return updated
