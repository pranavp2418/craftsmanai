from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.design import DesignActivityLog
from app.models.order import OrderActivityLog
from app.repositories.activity_log import (
    DesignActivityLogRepository,
    OrderActivityLogRepository,
)


class ActivityLogService:
    def __init__(self, db: Session):
        self.db = db
        self.design_logs = DesignActivityLogRepository(db)
        self.order_logs = OrderActivityLogRepository(db)

    def log_design(
        self,
        *,
        design_id: int,
        action_type: str,
        user_id: Optional[int] = None,
        message: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> DesignActivityLog:
        return self.design_logs.log(
            design_id=design_id,
            user_id=user_id,
            action_type=action_type,
            message=message,
            metadata=metadata,
        )

    def list_design_logs(self, design_id: int, limit: int = 100) -> List[DesignActivityLog]:
        return self.design_logs.list_logs(design_id, limit)

    def log_order(
        self,
        *,
        order_id: int,
        action_type: str,
        message: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> OrderActivityLog:
        return self.order_logs.log(
            order_id=order_id,
            action_type=action_type,
            message=message,
            metadata=metadata,
        )

    def list_order_logs(self, order_id: int, limit: int = 100) -> List[OrderActivityLog]:
        return self.order_logs.list_logs(order_id, limit)