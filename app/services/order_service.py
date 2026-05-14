from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.order import Order, OrderStatus
from app.repositories.order import OrderRepository
from app.repositories.activity_log import OrderActivityLogRepository


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.order_repo = OrderRepository(db)
        self.activity_repo = OrderActivityLogRepository(db)

    def create_order(
        self,
        *,
        design_id: int,
        customer_id: Optional[int],
        share_id: Optional[int],
    ) -> Order:
        order = self.order_repo.create_order(
            design_id=design_id,
            customer_id=customer_id,
            share_id=share_id,
        )
        self.activity_repo.log(
            order_id=order.id,
            action_type="ORDER_CREATED",
            message="Order created from approved design",
        )
        return order

    def get_order(self, order_id: int) -> Optional[Order]:
        return self.order_repo.get_by_id(order_id)

    def list_orders(
        self,
        *,
        customer_id: Optional[int] = None,
        status: Optional[OrderStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Order]:
        return self.order_repo.list_orders(
            customer_id=customer_id,
            status=status,
            limit=limit,
            offset=offset,
        )

    def update_status(self, order: Order, *, status: OrderStatus, message: Optional[str] = None) -> Order:
        updated = self.order_repo.update_status(order, status=status)
        self.activity_repo.log(
            order_id=order.id,
            action_type="STATUS_CHANGED",
            message=message or f"Order moved to {status.value}",
            metadata={"status": status.value},
        )
        return updated

    def assign_manufacturer(self, order: Order, manufacturer_id: Optional[int]) -> Order:
        updated = self.order_repo.assign_manufacturer(order, manufacturer_id)
        self.activity_repo.log(
            order_id=order.id,
            action_type="MANUFACTURER_ASSIGNED",
            message=f"Assigned manufacturer {manufacturer_id}",
            metadata={"manufacturer_id": manufacturer_id},
        )
        return updated