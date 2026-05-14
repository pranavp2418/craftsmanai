import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.models.design import DesignShare, DesignShareStatus
from app.repositories.design_share import DesignShareRepository
from app.repositories.activity_log import DesignActivityLogRepository


class DesignSharingService:
    def __init__(self, db: Session):
        self.db = db
        self.share_repo = DesignShareRepository(db)
        self.activity_repo = DesignActivityLogRepository(db)

    def _token(self) -> str:
        return secrets.token_urlsafe(18)

    def create_share(
        self,
        *,
        design_id: int,
        customer_id: Optional[int] = None,
        comment: Optional[str] = None,
    ) -> DesignShare:
        share = self.share_repo.create_share(
            design_id=design_id,
            customer_id=customer_id,
            public_token=self._token(),
            comment=comment,
        )
        self.activity_repo.log(
            design_id=design_id,
            action_type="DESIGN_SHARED",
            message="Design shared with external stakeholder",
            metadata={"share_id": share.id, "customer_id": customer_id},
        )
        return share

    def get_share(self, share_id: int) -> Optional[DesignShare]:
        return self.share_repo.get_by_id(share_id)

    def get_by_token(self, token: str) -> Optional[DesignShare]:
        return self.share_repo.get_by_token(token)

    def update_status(
        self,
        share: DesignShare,
        *,
        status: DesignShareStatus,
        comment: Optional[str] = None,
    ) -> DesignShare:
        updated = self.share_repo.update_status(share, status=status, comment=comment)
        action = {
            DesignShareStatus.ACCEPTED: "CUSTOMER_APPROVED",
            DesignShareStatus.REJECTED: "CUSTOMER_REJECTED",
            DesignShareStatus.NEEDS_REFINEMENT: "NEEDS_REFINEMENT",
            DesignShareStatus.PENDING: "DESIGN_SHARED",
        }[status]
        self.activity_repo.log(
            design_id=share.design_id,
            action_type=action,
            message=comment,
            metadata={"share_id": share.id, "status": status.value},
        )
        return updated