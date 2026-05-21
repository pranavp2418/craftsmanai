import secrets
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.manufacturer import Manufacturer
from app.repositories.manufacturer import ManufacturerRepository


class ManufacturerService:
    def __init__(self, db: Session):
        self.db = db
        self.manufacturer_repo = ManufacturerRepository(db)

    def _generate_token(self) -> str:
        return secrets.token_urlsafe(16)

    def create_manufacturer(
        self,
        *,
        created_by_user_id: int,
        name: str,
        speciality: Optional[str] = None,
        emails: Optional[str] = None,
        phone_number: Optional[str] = None,
        location: Optional[str] = None,
    ) -> Manufacturer:
        token = self._generate_token()
        return self.manufacturer_repo.create_manufacturer(
            created_by_user_id=created_by_user_id,
            name=name,
            speciality=speciality,
            emails=emails,
            phone_number=phone_number,
            location=location,
            public_token=token,
        )

    def get_manufacturer(self, manufacturer_id: int) -> Optional[Manufacturer]:
        return self.manufacturer_repo.get_by_id(manufacturer_id)

    def get_by_token(self, token: str) -> Optional[Manufacturer]:
        return self.manufacturer_repo.get_by_token(token)

    def list_manufacturers(self, *, created_by_user_id: int, limit: int = 50, offset: int = 0) -> List[Manufacturer]:
        return self.manufacturer_repo.list_manufacturers(created_by_user_id=created_by_user_id, limit=limit, offset=offset)

    def update_manufacturer(self, manufacturer: Manufacturer, **kwargs) -> Manufacturer:
        return self.manufacturer_repo.update_manufacturer(manufacturer, **kwargs)

    def count_manufacturers(self, *, created_by_user_id: int) -> int:
        return self.manufacturer_repo.count_manufacturers(created_by_user_id=created_by_user_id)

    def delete_manufacturer(self, manufacturer: Manufacturer) -> Manufacturer:
        return self.manufacturer_repo.delete_manufacturer(manufacturer)