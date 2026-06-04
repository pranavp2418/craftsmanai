import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.models.design import DesignShare, DesignShareStatus
from app.repositories.design_share import DesignShareRepository
from app.repositories.activity_log import DesignActivityLogRepository
from app.repositories.design_variant import DesignVariantRepository


class DesignSharingService:
    def __init__(self, db: Session):
        self.db = db
        self.share_repo = DesignShareRepository(db)
        self.activity_repo = DesignActivityLogRepository(db)
        self.variant_repo = DesignVariantRepository(db)

    def _token(self) -> str:
        return secrets.token_urlsafe(18)

    def create_share(
        self,
        *,
        design_variant_id: int,
        customer_id: Optional[int] = None,
        comment: Optional[str] = None,
        shared_metal: Optional[str] = None,
        require_approval: bool = False,
        allow_feedback: bool = True,
        allow_review_request: bool = True
    ) -> DesignShare:
        variant = self.variant_repo.get_by_id(design_variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {design_variant_id} not found")

        # Check if the design is already shared with another customer
        if customer_id is not None:
            customer_shares = self.share_repo.get_customer_shares_for_design(variant.design_id)
            for customer_share in customer_shares:
                if customer_share.customer_id != customer_id:
                    raise ValueError("Design is already shared with another customer.")

        # If this variant has already been shared, return the existing share
        # to reuse the same public_token instead of generating a new one.
        existing_shares = self.share_repo.list_for_design_variant(design_variant_id)
        if existing_shares:
            if existing_shares[0].status == DesignShareStatus.REJECTED:
                raise ValueError("Design already rejected by customer")
            return existing_shares[0]

        share = self.share_repo.create_share(
            design_variant_id=design_variant_id,
            customer_id=customer_id,
            public_token=self._token(),
            comment=comment,
            shared_metal=shared_metal,
        )
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="DESIGN_SHARED",
            message=f"Design shared with external stakeholder"
                    f"{f' (metal: {shared_metal})' if shared_metal else ''}",
            metadata={"share_id": share.id, "variant_id": design_variant_id, "customer_id": customer_id, "shared_metal": shared_metal},
        )
        return share

    def get_share(self, share_id: int) -> Optional[DesignShare]:
        return self.share_repo.get_by_id(share_id)

    def get_by_token(self, token: str) -> Optional[DesignShare]:
        return self.share_repo.get_by_token(token)

    def update_variant(
        self,
        share: DesignShare,
        *,
        design_variant_id: int,
    ) -> DesignShare:
        """Update which variant the share points to (after refinement)."""
        variant = self.variant_repo.get_by_id(design_variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {design_variant_id} not found")

        updated = self.share_repo.update_variant(share, design_variant_id=design_variant_id)

        # Put the share back to PENDING so the customer reviews the new variant
        if share.status == DesignShareStatus.NEEDS_REFINEMENT:
            self.share_repo.update_status(
                share,
                status=DesignShareStatus.PENDING,
                comment="Variant updated after refinement, pending customer review",
            )

        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="VARIANT_UPDATED_ON_SHARE",
            message=f"Share {share.id} updated to variant {design_variant_id}",
            metadata={"share_id": share.id, "new_variant_id": design_variant_id},
        )
        return updated

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
        # Get the variant's design_id for activity logging
        variant = share.design_variant
        design_id = variant.design_id if variant else None
        self.activity_repo.log(
            design_id=design_id,
            action_type=action,
            message=comment,
            metadata={"share_id": share.id, "variant_id": share.design_variant_id, "status": status.value},
        )
        return updated
