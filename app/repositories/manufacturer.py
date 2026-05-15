from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.manufacturer import Manufacturer


class ManufacturerRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_manufacturer(
        self,
        *,
        created_by_user_id: int,
        name: str,
        public_token: str,
        company_name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        address: Optional[str] = None,
        location: Optional[str] = None,
        is_active: bool = True,
    ) -> Manufacturer:
        manufacturer = Manufacturer(
            created_by_user_id=created_by_user_id,
            name=name,
            company_name=company_name,
            email=email,
            phone=phone,
            address=address,
            location=location,
            public_token=public_token,
            is_active=is_active,
        )
        self.db.add(manufacturer)
        self.db.commit()
        self.db.refresh(manufacturer)
        return manufacturer

    def get_by_id(self, manufacturer_id: int) -> Optional[Manufacturer]:
        return self.db.query(Manufacturer).filter(Manufacturer.id == manufacturer_id).first()

    def get_by_token(self, token: str) -> Optional[Manufacturer]:
        return self.db.query(Manufacturer).filter(Manufacturer.public_token == token).first()

    def list_manufacturers(self, *, created_by_user_id: int, limit: int = 50, offset: int = 0) -> List[Manufacturer]:
        return (
            self.db.query(Manufacturer)
            .filter(Manufacturer.created_by_user_id == created_by_user_id)
            .order_by(Manufacturer.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def update_manufacturer(self, manufacturer: Manufacturer, **kwargs) -> Manufacturer:
        for field, value in kwargs.items():
            if hasattr(manufacturer, field) and value is not None:
                setattr(manufacturer, field, value)
        self.db.commit()
        self.db.refresh(manufacturer)
        return manufacturer