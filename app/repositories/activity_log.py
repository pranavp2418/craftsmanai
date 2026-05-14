from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.design import DesignActivityLog
from app.models.order import OrderActivityLog


class DesignActivityLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def log(
        self,
        *,
        design_id: int,
        action_type: str,
        user_id: Optional[int] = None,
        message: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> DesignActivityLog:
        entry = DesignActivityLog(
            design_id=design_id,
            user_id=user_id,
            action_type=action_type,
            message=message,
            metadata_json=metadata,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_logs(self, design_id: int, limit: int = 100) -> List[DesignActivityLog]:
        return (
            self.db.query(DesignActivityLog)
            .filter(DesignActivityLog.design_id == design_id)
            .order_by(DesignActivityLog.created_at.desc())
            .limit(limit)
            .all()
        )


class OrderActivityLogRepository:
    def __init__(self, db: Session):
        self.db = db

    def log(
        self,
        *,
        order_id: int,
        action_type: str,
        message: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> OrderActivityLog:
        entry = OrderActivityLog(
            order_id=order_id,
            action_type=action_type,
            message=message,
            metadata_json=metadata,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_logs(self, order_id: int, limit: int = 100) -> List[OrderActivityLog]:
        return (
            self.db.query(OrderActivityLog)
            .filter(OrderActivityLog.order_id == order_id)
            .order_by(OrderActivityLog.created_at.desc())
            .limit(limit)
            .all()
        )