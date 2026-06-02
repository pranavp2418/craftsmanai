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
        updated = self.quote_repo.update_status(quote, status=status)
        self.activity_repo.log(
            order_id=quote.order_id,
            action_type="STATUS_CHANGED",
            message=message or f"Quote {status.value}",
            metadata={"quote_id": quote.id, "status": status.value},
        )
        return updated