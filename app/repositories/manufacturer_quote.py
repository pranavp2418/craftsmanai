from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.order import ManufacturerQuote, ManufacturerQuoteStatus


class ManufacturerQuoteRepository:
    def __init__(self, db: Session):
        self.db = db

    def submit_quote(
        self,
        *,
        order_id: int,
        manufacturer_id: int,
        cost_price: Optional[float] = None,
        delivery_time_days: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> ManufacturerQuote:
        quote = ManufacturerQuote(
            order_id=order_id,
            manufacturer_id=manufacturer_id,
            cost_price=cost_price,
            delivery_time_days=delivery_time_days,
            notes=notes,
        )
        self.db.add(quote)
        self.db.commit()
        self.db.refresh(quote)
        return quote

    def get_by_id(self, quote_id: int) -> Optional[ManufacturerQuote]:
        return self.db.query(ManufacturerQuote).filter(ManufacturerQuote.id == quote_id).first()

    def list_for_order(self, order_id: int) -> List[ManufacturerQuote]:
        return (
            self.db.query(ManufacturerQuote)
            .filter(ManufacturerQuote.order_id == order_id)
            .order_by(ManufacturerQuote.created_at.desc())
            .all()
        )

    def update_status(
        self,
        quote: ManufacturerQuote,
        *,
        status: ManufacturerQuoteStatus,
    ) -> ManufacturerQuote:
        quote.status = status
        self.db.commit()
        self.db.refresh(quote)
        return quote