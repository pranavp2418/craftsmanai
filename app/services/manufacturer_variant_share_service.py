import secrets
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.design import DesignVariantManufacturerShare, ManufacturerShareStatus
from app.repositories.manufacturer_variant_share import DesignVariantManufacturerShareRepository
from app.repositories.design_variant import DesignVariantRepository
from app.repositories.activity_log import DesignActivityLogRepository
from app.repositories.manufacturer import ManufacturerRepository


class DesignVariantManufacturerShareService:
    def __init__(self, db: Session):
        self.db = db
        self.share_repo = DesignVariantManufacturerShareRepository(db)
        self.variant_repo = DesignVariantRepository(db)
        self.activity_repo = DesignActivityLogRepository(db)
        self.manufacturer_repo = ManufacturerRepository(db)

    def _token(self) -> str:
        return secrets.token_urlsafe(18)

    def build_review_url(self, share: DesignVariantManufacturerShare) -> Optional[str]:
        manufacturer = self.manufacturer_repo.get_by_id(share.manufacturer_id)
        if not manufacturer:
            return None

        return (
            f"{settings.FRONTEND_URL.rstrip('/')}"
            f"/manufacturer/review/{manufacturer.public_token}?token={share.public_token}"
        )

    def create_share(
        self,
        *,
        design_variant_id: int,
        manufacturer_id: int,
        shared_metal: Optional[str] = None,
    ) -> DesignVariantManufacturerShare:
        """Create a manufacturer share link for a design variant.

        Args:
            design_variant_id: ID of the design variant to share.
            manufacturer_id: ID of the manufacturer to share with.
            shared_metal: Optional specific metal to share (e.g. "gold", "rose_gold").
                         When set, the manufacturer view will only show images for this metal.
                         This value is typically inherited from the customer share record.
        """
        variant = self.variant_repo.get_by_id(design_variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {design_variant_id} not found")

        share = self.share_repo.create_share(
            design_variant_id=design_variant_id,
            manufacturer_id=manufacturer_id,
            public_token=self._token(),
            shared_metal=shared_metal,
        )
        review_url = self.build_review_url(share)
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="VARIANT_SHARED_WITH_MANUFACTURER",
            message=f"Design variant shared with manufacturer for quoting"
                    f"{f' (metal: {shared_metal})' if shared_metal else ''}",
            metadata={
                "variant_id": design_variant_id,
                "manufacturer_id": manufacturer_id,
                "share_id": share.id,
                **({"review_url": review_url} if review_url else {}),
                "shared_metal": shared_metal,
            },
        )
        return share

    def get_by_token(self, token: str) -> Optional[DesignVariantManufacturerShare]:
        return self.share_repo.get_by_token(token)

    def list_for_variant(self, design_variant_id: int) -> list[DesignVariantManufacturerShare]:
        return self.share_repo.list_for_variant(design_variant_id)

    def submit_quote(
        self,
        share: DesignVariantManufacturerShare,
        *,
        cost_price: float,
        delivery_time_days: int,
        notes: Optional[str] = None,
    ) -> DesignVariantManufacturerShare:
        """Manufacturer submits a quote for the shared variant."""
        updated = self.share_repo.update_share(
            share,
            status=ManufacturerShareStatus.QUOTED,
            cost_price=cost_price,
            delivery_time_days=delivery_time_days,
            notes=notes,
        )
        variant = share.design_variant
        self.activity_repo.log(
            design_id=variant.design_id if variant else None,
            action_type="MANUFACTURER_QUOTE_SUBMITTED",
            message=f"Manufacturer submitted quote: ${cost_price}, {delivery_time_days} days",
            metadata={
                "variant_id": share.design_variant_id,
                "manufacturer_id": share.manufacturer_id,
                "share_id": share.id,
                "cost_price": cost_price,
                "delivery_time_days": delivery_time_days,
            },
        )
        return updated