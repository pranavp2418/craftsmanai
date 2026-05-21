from typing import List, Optional
from sqlalchemy import func
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
        speciality: Optional[str] = None,
        emails: Optional[str] = None,
        phone_number: Optional[str] = None,
        location: Optional[str] = None,
        is_active: bool = True,
    ) -> Manufacturer:
        manufacturer = Manufacturer(
            created_by_user_id=created_by_user_id,
            name=name,
            speciality=speciality,
            emails=emails,
            phone_number=phone_number,
            location=location,
            public_token=public_token,
            is_active=is_active,
        )
        self.db.add(manufacturer)
        self.db.commit()
        self.db.refresh(manufacturer)
        return manufacturer

    def get_by_id(self, manufacturer_id: int) -> Optional[Manufacturer]:
        return self.db.query(Manufacturer).filter(Manufacturer.id == manufacturer_id, Manufacturer.is_deleted == False).first()

    def get_by_token(self, token: str) -> Optional[Manufacturer]:
        return self.db.query(Manufacturer).filter(Manufacturer.public_token == token, Manufacturer.is_deleted == False).first()

    def list_manufacturers(self, *, created_by_user_id: int, limit: int = 50, offset: int = 0) -> List[Manufacturer]:
        return (
            self.db.query(Manufacturer)
            .filter(Manufacturer.created_by_user_id == created_by_user_id, Manufacturer.is_deleted == False)
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

    def count_manufacturers(self, *, created_by_user_id: int) -> int:
        return (
            self.db.query(func.count(Manufacturer.id))
            .filter(Manufacturer.created_by_user_id == created_by_user_id, Manufacturer.is_deleted == False)
            .scalar()
            or 0
        )

    def delete_manufacturer(self, manufacturer: Manufacturer) -> Manufacturer:
        manufacturer.is_deleted = True
        self.db.commit()
        self.db.refresh(manufacturer)
        return manufacturer