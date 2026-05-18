from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.order import Order, OrderStatus
from app.models.design import DesignVariant
from app.repositories.order import OrderRepository
from app.repositories.design_variant import DesignVariantRepository
from app.repositories.design_share import DesignShareRepository
from app.repositories.activity_log import OrderActivityLogRepository, DesignActivityLogRepository
from app.services.design_sharing_service import DesignSharingService


class OrderService:
    def __init__(self, db: Session):
        self.db = db
        self.order_repo = OrderRepository(db)
        self.variant_repo = DesignVariantRepository(db)
        self.share_repo = DesignShareRepository(db)
        self.activity_repo = OrderActivityLogRepository(db)
        self.design_activity_repo = DesignActivityLogRepository(db)

    def create_order(
        self,
        *,
        design_variant_id: int,
        customer_id: int,
    ) -> tuple[Order, int]:
        """Create an order from a selected design variant.

        Steps:
        1. Lookup the variant and its parent design.
        2. Resolve (or create) the ``DesignShare`` for this design + customer.
        3. Create the ``Order`` linked to the share.

        Returns ``(order, share_id)``.
        """
        # 1. Resolve variant → design
        variant = self.variant_repo.get_by_id(design_variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {design_variant_id} not found")
        design_id = variant.design_id

        # 2. Resolve share – reuse existing or create one
        existing_shares = self.share_repo.list_for_design(design_id)
        share = next(
            (s for s in existing_shares if s.customer_id == customer_id),
            None,
        )
        if share is None:
            sharing_service = DesignSharingService(self.db)
            share = sharing_service.create_share(
                design_id=design_id,
                customer_id=customer_id,
            )

        # 3. Create the order
        order = self.order_repo.create_order(
            design_id=design_id,
            customer_id=customer_id,
            share_id=share.id,
        )

        self.activity_repo.log(
            order_id=order.id,
            action_type="ORDER_CREATED",
            message="Order created from approved design",
            metadata={
                "design_variant_id": design_variant_id,
                "share_id": share.id,
            },
        )

        return order, share.id

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