from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.design import DesignVariantManufacturerShare, ManufacturerShareStatus


class DesignVariantManufacturerShareRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_share(
        self,
        *,
        design_variant_id: int,
        manufacturer_id: int,
        public_token: str,
        status: ManufacturerShareStatus = ManufacturerShareStatus.PENDING,
        shared_metal: Optional[str] = None,
    ) -> DesignVariantManufacturerShare:
        share = DesignVariantManufacturerShare(
            design_variant_id=design_variant_id,
            manufacturer_id=manufacturer_id,
            public_token=public_token,
            status=status,
            shared_metal=shared_metal,
        )
        self.db.add(share)
        self.db.commit()
        self.db.refresh(share)
        return share

    def get_by_id(self, share_id: int) -> Optional[DesignVariantManufacturerShare]:
        return self.db.query(DesignVariantManufacturerShare).filter(DesignVariantManufacturerShare.id == share_id).first()

    def get_by_token(self, token: str) -> Optional[DesignVariantManufacturerShare]:
        return self.db.query(DesignVariantManufacturerShare).filter(DesignVariantManufacturerShare.public_token == token).first()

    def list_for_variant(self, design_variant_id: int) -> List[DesignVariantManufacturerShare]:
        return (
            self.db.query(DesignVariantManufacturerShare)
            .filter(DesignVariantManufacturerShare.design_variant_id == design_variant_id)
            .order_by(DesignVariantManufacturerShare.created_at.desc())
            .all()
        )

    def list_for_manufacturer(self, manufacturer_id: int) -> List[DesignVariantManufacturerShare]:
        return (
            self.db.query(DesignVariantManufacturerShare)
            .filter(DesignVariantManufacturerShare.manufacturer_id == manufacturer_id)
            .order_by(DesignVariantManufacturerShare.created_at.desc())
            .all()
        )

    def update_share(
        self,
        share: DesignVariantManufacturerShare,
        **kwargs,
    ) -> DesignVariantManufacturerShare:
        for field, value in kwargs.items():
            if hasattr(share, field) and value is not None:
                setattr(share, field, value)
        self.db.commit()
        self.db.refresh(share)
        return share