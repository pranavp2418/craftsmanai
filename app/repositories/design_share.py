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
        shared_metal: Optional[str] = None,
        shared_angles: Optional[List[str]] = None,
    ) -> DesignShare:
        share = DesignShare(
            design_variant_id=design_variant_id,
            customer_id=customer_id,
            public_token=public_token,
            status=status,
            comment=comment,
            shared_metal=shared_metal,
            shared_angles=shared_angles,
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

    def get_customer_shares_for_design(self, design_id: int) -> List[DesignShare]:
        from app.models.design import DesignVariant
        return (
            self.db.query(DesignShare)
            .join(DesignVariant, DesignVariant.id == DesignShare.design_variant_id)
            .filter(
                DesignVariant.design_id == design_id,
                DesignShare.customer_id.isnot(None)
            )
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
