from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.order import ManufacturerQuote, ManufacturerQuoteStatus
from app.repositories.manufacturer_quote import ManufacturerQuoteRepository
from app.repositories.activity_log import OrderActivityLogRepository


class ManufacturerQuoteService:
    def __init__(self, db: Session):
        self.db = db
        self.quote_repo = ManufacturerQuoteRepository(db)
        self.activity_repo = OrderActivityLogRepository(db)

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
        return quote

    def list_quotes(self, order_id: int) -> List[ManufacturerQuote]:
        return self.quote_repo.list_for_order(order_id)

    def update_status(
        self,
        quote: ManufacturerQuote,
        *,
        status: ManufacturerQuoteStatus,
        message: Optional[str] = None,
    ) -> ManufacturerQuote:
        updated = self.quote_repo.update_status(quote, status=status)
        self.activity_repo.log(
            order_id=quote.order_id,
            action_type="STATUS_CHANGED",
            message=message or f"Quote {status.value}",
            metadata={"quote_id": quote.id, "status": status.value},
        )
        return updated