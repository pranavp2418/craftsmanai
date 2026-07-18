from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.design import Design, DesignStatus
from app.models.order import Order, OrderStatus, ManufacturerQuote, ManufacturerQuoteStatus
from app.repositories.design import DesignRepository
from app.repositories.manufacturer_quote import ManufacturerQuoteRepository
from app.repositories.activity_log import OrderActivityLogRepository, DesignActivityLogRepository
from app.repositories.order import OrderRepository
from app.repositories.manufacturer_variant_share import DesignVariantManufacturerShareRepository
from app.models.design import ManufacturerShareStatus
from app.services.notification_service import NotificationService


class ManufacturerQuoteService:
    def __init__(self, db: Session):
        self.db = db
        self.quote_repo = ManufacturerQuoteRepository(db)
        self.activity_repo = OrderActivityLogRepository(db)
        self.design_activity_repo = DesignActivityLogRepository(db)
        self.order_repo = OrderRepository(db)
        self.variant_share_repo = DesignVariantManufacturerShareRepository(db)
        self.notification_service = NotificationService(db)

    def submit_quote(
        self,
        *,
        order_id: int,
        manufacturer_id: int,
        cost_price: Optional[float] = None,
        delivery_time_days: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> ManufacturerQuote:
        quote = self.quote_repo.submit_quote(
            order_id=order_id,
            manufacturer_id=manufacturer_id,
            cost_price=cost_price,
            delivery_time_days=delivery_time_days,
            notes=notes,
        )
        self.activity_repo.log(
            order_id=order_id,
            action_type="QUOTE_SUBMITTED",
            message="Manufacturer submitted quote",
            metadata={"quote_id": quote.id, "manufacturer_id": manufacturer_id},
        )

        # Notify the retailer via in-app notification and email
        try:
            from sqlalchemy.orm import joinedload
            from app.models.design import Design
            from app.models.user import User

            order = (
                self.db.query(Order)
                .options(joinedload(Order.design))
                .filter(Order.id == order_id)
                .first()
            )

            recipient_user_id = None
            if order and order.design_id:
                design = self.db.query(Design).filter(Design.id == order.design_id).first()
                if design:
                    recipient_user_id = design.user_id

            if recipient_user_id:
                manufacturer_name = (
                    quote.manufacturer.name if quote.manufacturer else f"Manufacturer #{manufacturer_id}"
                )

                self.notification_service.send_notification(
                    user_id=recipient_user_id,
                    type="quote_submitted",
                    title="New quote submitted",
                    message=f"{manufacturer_name} submitted a quote for Design #{design.design_code if design else ''}.",
                    source="quote",
                    reference_id=quote.id,
                    data={
                        "quote_id": quote.id,
                        "order_id": order_id,
                        "manufacturer_id": manufacturer_id,
                        "manufacturer_name": manufacturer_name,
                        "cost_price": cost_price,
                        "delivery_time_days": delivery_time_days,
                    },
                )

                from app.tasks.email_tasks import send_quote_submitted_email

                retailer = self.db.query(User).filter(User.id == recipient_user_id).first()
                if retailer:
                    render_image_url = ""
                    if order and order.share and order.share.design:
                        render_image_url = (
                            order.share.design.base_design_image_url
                            or order.share.design.hero_image_url
                            or ""
                        )

                    send_quote_submitted_email.delay(
                        to=retailer.email,
                        retailer_name=retailer.full_name or retailer.username,
                        manufacturer_name=manufacturer_name,
                        design_number=design.design_code if design else "",
                        estimated_cost=f"${float(cost_price):,.2f}" if cost_price is not None else "Not provided",
                        production_timeline=f"{delivery_time_days} days" if delivery_time_days else "Not provided",
                        quote_url="#" ,
                        render_image_url=render_image_url,
                    )
        except Exception as exc:
            logger.error(f"Failed to send quote submission notification for quote {quote.id}: {exc}")

        return quote

    def list_quotes(self, order_id: int) -> List[ManufacturerQuote]:
        return self.quote_repo.list_for_order(order_id)

    def list_quotes_with_details(self, order_id: int) -> List[dict]:
        quotes = self.quote_repo.list_for_order(order_id)
        
        result = []
        for q in quotes:
            # Get the manufacturer's name
            m_name = None
            if q.manufacturer:
                m_name = q.manufacturer.name
                
            # Get the metal
            # First check order share
            metal = None
            if q.order and q.order.share:
                metal = q.order.share.shared_metal
                
            result.append({
                "id": q.id,
                "order_id": q.order_id,
                "manufacturer_id": q.manufacturer_id,
                "cost_price": q.cost_price,
                "delivery_time_days": q.delivery_time_days,
                "notes": q.notes,
                "status": q.status,
                "created_at": q.created_at,
                "manufacturer_name": m_name,
                "metal": metal,
            })
            
        return result

    def update_status(
        self,
        quote: ManufacturerQuote,
        *,
        status: ManufacturerQuoteStatus,
        message: Optional[str] = None,
    ) -> ManufacturerQuote:
        if status == ManufacturerQuoteStatus.APPROVED:
            order = quote.order or self.order_repo.get_by_id(quote.order_id)
            design_id = order.design_id if order else None
            if design_id is not None:
                accepted_for_design = self.quote_repo.get_accepted_for_design(design_id)
                if accepted_for_design and accepted_for_design.id != quote.id:
                    raise ValueError("A manufacturer is already approved for this design")

        updated = self.quote_repo.update_status(quote, status=status)

        if status == ManufacturerQuoteStatus.APPROVED:
            order = quote.order or self.order_repo.get_by_id(quote.order_id)
            if order:
                self.order_repo.assign_manufacturer(order, quote.manufacturer_id)
                self.order_repo.update_status(order, status=OrderStatus.APPROVED)

                # Update the parent Design status to MANUFACTURER_APPROVED
                if order.design:
                    design_repo = DesignRepository(self.db)
                    design_repo.update_design(order.design, status=DesignStatus.MANUFACTURER_APPROVED)

        # Keep design_variant_manufacturer_shares status synchronized.
        order = quote.order or self.order_repo.get_by_id(quote.order_id)
        if order:
            share = self.variant_share_repo.get_latest_for_design_and_manufacturer(
                design_id=order.design_id,
                manufacturer_id=quote.manufacturer_id,
            )
            if share:
                target_share_status = None
                if status == ManufacturerQuoteStatus.APPROVED:
                    target_share_status = ManufacturerShareStatus.ACCEPTED
                elif status == ManufacturerQuoteStatus.REJECTED:
                    target_share_status = ManufacturerShareStatus.REJECTED

                if target_share_status is not None:
                    self.variant_share_repo.update_share(share, status=target_share_status)

        self.activity_repo.log(
            order_id=quote.order_id,
            action_type="STATUS_CHANGED",
            message=message or f"Quote {status.value}",
            metadata={"quote_id": quote.id, "status": status.value},
        )

        # Also log to DesignActivityLog for admin dashboard visibility
        order = quote.order or self.order_repo.get_by_id(quote.order_id)
        if order and order.design_id:
            design_action = {
                ManufacturerQuoteStatus.APPROVED: "MANUFACTURER_APPROVED",
                ManufacturerQuoteStatus.REJECTED: "MANUFACTURER_REJECTED",
            }.get(status, "QUOTE_STATUS_CHANGED")
            manufacturer_name = quote.manufacturer.name if quote.manufacturer else f"Manufacturer #{quote.manufacturer_id}"
            self.design_activity_repo.log(
                design_id=order.design_id,
                action_type=design_action,
                message=message or f"Quote from {manufacturer_name} {status.value.lower()}",
                metadata={
                    "quote_id": quote.id,
                    "order_id": quote.order_id,
                    "manufacturer_id": quote.manufacturer_id,
                    "status": status.value,
                },
            )

        # Restore real-time sync by notifying design owner on approval/rejection.
        order = quote.order or self.order_repo.get_by_id(quote.order_id)
        if order and order.design and order.design.user_id:
            status_label = "Approved" if status == ManufacturerQuoteStatus.APPROVED else "Rejected"
            if status in (ManufacturerQuoteStatus.APPROVED, ManufacturerQuoteStatus.REJECTED):
                from app.models.notification_setting import NotificationSetting
                from app.services.webpush_service import WebPushService

                recipient_user_id = order.design.user_id

                # In-app notification (always sent regardless of settings)
                self.notification_service.send_notification(
                    user_id=recipient_user_id,
                    type="quote_status",
                    title=f"Quote {status_label}",
                    message=message or f"Quote #{quote.id} was {status_label.lower()}.",
                    source="quote",
                    reference_id=quote.id,
                    data={
                        "quote_id": quote.id,
                        "order_id": quote.order_id,
                        "manufacturer_id": quote.manufacturer_id,
                        "status": status.value,
                    },
                )

                # Web Push notification (only if manufacturer_updates AND push_notifications are enabled)
                notif_setting = self.db.query(NotificationSetting).filter(
                    NotificationSetting.user_id == recipient_user_id
                ).first()
                if notif_setting and notif_setting.manufacturer_updates and notif_setting.push_notifications:
                    manufacturer_name = quote.manufacturer.name if quote.manufacturer else "A manufacturer"
                    WebPushService.send_push(
                        db=self.db,
                        user_id=recipient_user_id,
                        title=f"Quote {status_label}",
                        body=message or f"Quote from {manufacturer_name} was {status_label.lower()}.",
                        url=f"/designs/{order.design_id}" if order.design_id else None,
                        data={
                            "quote_id": quote.id,
                            "order_id": quote.order_id,
                            "manufacturer_id": quote.manufacturer_id,
                            "status": status.value,
                            "type": "manufacturer_quote_status",
                        },
                        tag=f"manufacturer-quote-status-{quote.id}",
                    )
        return updated