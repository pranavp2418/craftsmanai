from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.order import Order, OrderStatus


class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_order(
        self,
        *,
        design_id: int,
        customer_id: Optional[int],
        share_id: Optional[int],
        status: OrderStatus = OrderStatus.CREATED,
        current_manufacturer_id: Optional[int] = None,
    ) -> Order:
        order = Order(
            design_id=design_id,
            customer_id=customer_id,
            share_id=share_id,
            status=status,
            current_manufacturer_id=current_manufacturer_id,
        )
        self.db.add(order)
        self.db.commit()
        self.db.refresh(order)
        return order

    def get_by_id(self, order_id: int) -> Optional[Order]:
        return self.db.query(Order).filter(Order.id == order_id).first()

    def get_by_share_id(self, share_id: int) -> Optional[Order]:
        return self.db.query(Order).filter(Order.share_id == share_id).order_by(Order.created_at.desc()).first()

    def get_latest_by_design_id(self, design_id: int) -> Optional[Order]:
        return self.db.query(Order).filter(Order.design_id == design_id).order_by(Order.created_at.desc()).first()

    def list_orders(
        self,
        *,
        customer_id: Optional[int] = None,
        status: Optional[OrderStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Order]:
        query = self.db.query(Order)
        if customer_id:
            query = query.filter(Order.customer_id == customer_id)
        if status:
            query = query.filter(Order.status == status)
        return query.order_by(Order.created_at.desc()).offset(offset).limit(limit).all()

    def update_status(self, order: Order, *, status: OrderStatus) -> Order:
        order.status = status
        self.db.commit()
        self.db.refresh(order)
        return order

    def assign_manufacturer(self, order: Order, manufacturer_id: Optional[int]) -> Order:
        order.current_manufacturer_id = manufacturer_id
        self.db.commit()
        self.db.refresh(order)
        return order