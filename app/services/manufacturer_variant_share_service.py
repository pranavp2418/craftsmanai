import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.design import Design, DesignStatus, DesignVariantManufacturerShare, ManufacturerShareStatus
from app.repositories.design import DesignRepository
from app.repositories.manufacturer_variant_share import DesignVariantManufacturerShareRepository
from app.repositories.design_variant import DesignVariantRepository
from app.repositories.activity_log import DesignActivityLogRepository
from app.repositories.manufacturer import ManufacturerRepository
from app.repositories.order import OrderRepository
from app.repositories.manufacturer_quote import ManufacturerQuoteRepository
from app.models.order import ManufacturerQuoteStatus
from app.repositories.design_share import DesignShareRepository


class DesignVariantManufacturerShareService:
    def __init__(self, db: Session):
        self.db = db
        self.share_repo = DesignVariantManufacturerShareRepository(db)
        self.variant_repo = DesignVariantRepository(db)
        self.activity_repo = DesignActivityLogRepository(db)
        self.manufacturer_repo = ManufacturerRepository(db)
        self.order_repo = OrderRepository(db)
        self.quote_repo = ManufacturerQuoteRepository(db)
        self.design_share_repo = DesignShareRepository(db)

    def _resolve_or_create_order_for_variant(self, variant) -> Optional[object]:
        if not variant:
            return None

        order = self.order_repo.get_latest_by_design_id(variant.design_id)
        if order:
            return order

        # Create an order context so manufacturer quotes are always persisted.
        shares = self.design_share_repo.list_for_design_variant(variant.id)
        latest_share = shares[0] if shares else None
        customer_id = latest_share.customer_id if latest_share else None
        share_id = latest_share.id if latest_share else None

        return self.order_repo.create_order(
            design_id=variant.design_id,
            customer_id=customer_id,
            share_id=share_id,
        )

    def _token(self) -> str:
        return secrets.token_urlsafe(18)

    def build_review_url(self, share: DesignVariantManufacturerShare) -> Optional[str]:
        manufacturer = self.manufacturer_repo.get_by_id(share.manufacturer_id)
        if not manufacturer:
            return None

        return (
            f"{settings.FRONTEND_URL.rstrip('/')}"
            f"/manufacturer/review/{share.public_token}"
        )

    def create_share(
        self,
        *,
        design_variant_id: int,
        manufacturer_id: int,
        shared_metal: Optional[str] = None,
    ) -> DesignVariantManufacturerShare:
        """Create a manufacturer share link for a design variant.

        Args:
            design_variant_id: ID of the design variant to share.
            manufacturer_id: ID of the manufacturer to share with.
            shared_metal: Optional specific metal to share (e.g. "gold", "rose_gold").
                         When set, the manufacturer view will only show images for this metal.
                         This value is typically inherited from the customer share record.
        """
        variant = self.variant_repo.get_by_id(design_variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {design_variant_id} not found")

        share = self.share_repo.create_share(
            design_variant_id=design_variant_id,
            manufacturer_id=manufacturer_id,
            public_token=self._token(),
            shared_metal=shared_metal,
        )
        review_url = self.build_review_url(share)
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="VARIANT_SHARED_WITH_MANUFACTURER",
            message=f"Design variant shared with manufacturer for quoting"
                    f"{f' (metal: {shared_metal})' if shared_metal else ''}",
            metadata={
                "variant_id": design_variant_id,
                "manufacturer_id": manufacturer_id,
                "share_id": share.id,
                **({"review_url": review_url} if review_url else {}),
                "shared_metal": shared_metal,
            },
        )
        return share

    def get_by_token(self, token: str) -> Optional[DesignVariantManufacturerShare]:
        return self.share_repo.get_by_token(token)

    def list_for_variant(self, design_variant_id: int) -> list[DesignVariantManufacturerShare]:
        return self.share_repo.list_for_variant(design_variant_id)

    def submit_quote(
        self,
        share: DesignVariantManufacturerShare,
        *,
        cost_price: float,
        delivery_time_days: int,
        notes: Optional[str] = None,
    ) -> DesignVariantManufacturerShare:
        """Manufacturer submits a quote for the shared variant."""
        variant = share.design_variant
        design_id = variant.design_id if variant else None

        # If a manufacturer has already been approved for this design, block other quotes.
        if design_id is not None:
            accepted_quote = self.quote_repo.get_accepted_for_design(design_id)
            if accepted_quote and accepted_quote.manufacturer_id != share.manufacturer_id:
                raise ValueError("A manufacturer is already approved for this design")

        # Keep existing share table fields in sync for backward compatibility.
        updated = self.share_repo.update_share(
            share,
            status=ManufacturerShareStatus.QUOTED,
            cost_price=cost_price,
            delivery_time_days=delivery_time_days,
            notes=notes,
        )

        # Canonical quote persistence in manufacturer_quotes table.
        if design_id is not None:
            order = self._resolve_or_create_order_for_variant(variant)
            if order:
                self.quote_repo.create_or_update_quote(
                    order_id=order.id,
                    manufacturer_id=share.manufacturer_id,
                    cost_price=cost_price,
                    delivery_time_days=delivery_time_days,
                    notes=notes,
                    status=ManufacturerQuoteStatus.SUBMITTED,
                )
                from app.models.order import OrderStatus
                if order.status == OrderStatus.CREATED:
                    self.order_repo.update_status(order, status=OrderStatus.QUOTED)
            
            # Also update the customer share if one exists
            shares = self.design_share_repo.list_for_design_variant(share.design_variant_id)
            if shares:
                from app.models.design import DesignShareStatus
                self.design_share_repo.update_status(shares[0], status=DesignShareStatus.Quoted)

        # Update the parent Design status to QUOTE_RECEIVED
        if variant and variant.design:
            design_repo = DesignRepository(self.db)
            design_repo.update_design(variant.design, status=DesignStatus.QUOTE_RECEIVED)

        self.activity_repo.log(
            design_id=variant.design_id if variant else None,
            action_type="MANUFACTURER_QUOTE_SUBMITTED",
            message=f"Manufacturer submitted quote: ${cost_price}, {delivery_time_days} days",
            metadata={
                "variant_id": share.design_variant_id,
                "manufacturer_id": share.manufacturer_id,
                "share_id": share.id,
                "cost_price": cost_price,
                "delivery_time_days": delivery_time_days,
            },
        )

        # Also log QUOTE_RECEIVED status change to DesignActivityLog
        if variant and variant.design:
            manufacturer_name = share.manufacturer.name if share.manufacturer else f"Manufacturer #{share.manufacturer_id}"
            self.activity_repo.log(
                design_id=variant.design_id,
                action_type="QUOTE_RECEIVED",
                message=f"Quote received from {manufacturer_name}: ${cost_price}, {delivery_time_days} days",
                metadata={
                    "variant_id": share.design_variant_id,
                    "manufacturer_id": share.manufacturer_id,
                    "share_id": share.id,
                    "cost_price": cost_price,
                    "delivery_time_days": delivery_time_days,
                },
            )

        # Trigger notification to the retailer
        recipient_user_id = None
        if share.manufacturer:
            recipient_user_id = share.manufacturer.created_by_user_id
        if not recipient_user_id and variant and variant.design:
            recipient_user_id = variant.design.user_id

        if recipient_user_id:
            try:
                from app.models.notification_setting import NotificationSetting
                from app.services.notification_service import NotificationService
                from app.services.webpush_service import WebPushService

                notification_service = NotificationService(self.db)
                
                manufacturer_name = share.manufacturer.name if share.manufacturer else "A manufacturer"
                design_name = variant.design.name if (variant and variant.design and variant.design.name) else (variant.design.design_code if (variant and variant.design) else "design")
                variant_name = variant.variant_name if variant else ""
                
                notification_title = "Manufacturer Quote Submitted"
                notification_message = f"Manufacturer '{manufacturer_name}' submitted a quote for variant '{variant_name}' of design '{design_name}': ${cost_price} (Delivery: {delivery_time_days} days)."
                if notes:
                    notification_message += f" Note: {notes}"
                
                # In-app notification (always sent regardless of settings)
                notification_service.send_notification(
                    user_id=recipient_user_id,
                    type="manufacturer_quote_submitted",
                    title=notification_title,
                    message=notification_message,
                    source="manufacturer_share",
                    reference_id=share.id,
                    data={
                        "share_id": share.id,
                        "design_id": variant.design_id if variant else None,
                        "variant_id": share.design_variant_id,
                        "cost_price": cost_price,
                        "delivery_time_days": delivery_time_days,
                    }
                )

                # Check notification settings for email/push gating
                notif_setting = self.db.query(NotificationSetting).filter(
                    NotificationSetting.user_id == recipient_user_id
                ).first()

                # Web Push notification (only if manufacturer_updates AND push_notifications are enabled)
                if notif_setting and notif_setting.manufacturer_updates and notif_setting.push_notifications:
                    WebPushService.send_push(
                        db=self.db,
                        user_id=recipient_user_id,
                        title=notification_title,
                        body=notification_message,
                        url=f"/designs/{variant.design_id}" if variant and variant.design_id else None,
                        data={
                            "share_id": share.id,
                            "design_id": variant.design_id if variant else None,
                            "variant_id": share.design_variant_id,
                            "cost_price": cost_price,
                            "delivery_time_days": delivery_time_days,
                            "type": "manufacturer_quote_submitted",
                        },
                        tag=f"manufacturer-quote-{share.id}",
                    )
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to send manufacturer quote notification: {str(e)}")

        return updated

    def get_quote_for_share(self, share: DesignVariantManufacturerShare):
        variant = share.design_variant
        if not variant:
            return None

        order = self.order_repo.get_latest_by_design_id(variant.design_id)
        if not order:
            return None

        return self.quote_repo.get_by_order_and_manufacturer(order.id, share.manufacturer_id)