from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.design import DesignShare, DesignShareStatus


class DesignShareRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_share(
        self,
        *,
        design_variant_id: int,
        public_token: str,
        customer_id: Optional[int] = None,
        status: DesignShareStatus = DesignShareStatus.PENDING,
        comment: Optional[str] = None,
        require_approval: bool = False,
        allow_feedback: bool = True,    
        allow_review_request: bool = True
    ) -> DesignShare:
        share = DesignShare(
            design_variant_id=design_variant_id,
            customer_id=customer_id,
            public_token=public_token,
            status=status,
            comment=comment,
            require_approval=require_approval,
            allow_feedback=allow_feedback,
            allow_review_request=allow_review_request
        )
        self.db.add(share)
        self.db.commit()
        self.db.refresh(share)
        return share

    def get_by_id(self, share_id: int) -> Optional[DesignShare]:
        return self.db.query(DesignShare).filter(DesignShare.id == share_id).first()

    def get_by_token(self, token: str) -> Optional[DesignShare]:
        return self.db.query(DesignShare).filter(DesignShare.public_token == token).first()

    def list_for_design_variant(self, design_variant_id: int) -> List[DesignShare]:
        return (
            self.db.query(DesignShare)
            .filter(DesignShare.design_variant_id == design_variant_id)
            .order_by(DesignShare.created_at.desc())
            .all()
        )

    def list_for_customer(self, customer_id: int) -> List[DesignShare]:
        return (
            self.db.query(DesignShare)
            .filter(DesignShare.customer_id == customer_id)
            .order_by(DesignShare.created_at.desc())
            .all()
        )

    def update_status(
        self,
        share: DesignShare,
        *,
        status: DesignShareStatus,
        comment: Optional[str] = None,
    ) -> DesignShare:
        share.status = status
        share.comment = comment
        share.reviewed_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(share)
        return share

    def update_variant(self, share: DesignShare, *, design_variant_id: int) -> DesignShare:
        """Update the variant reference on a share (e.g. after refinement)."""
        share.design_variant_id = design_variant_id
        self.db.commit()
        self.db.refresh(share)
        return share
