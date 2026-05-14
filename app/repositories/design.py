from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.design import Design, DesignStatus


class DesignRepository:
    """Data access layer for jewellery designs."""

    def __init__(self, db: Session):
        self.db = db

    def get_next_sequence_number(self, user_id: int) -> int:
        """Return the next sequential number for a user's designs."""
        max_sequence = self.db.query(func.max(Design.sequence_number)).filter(Design.user_id == user_id).scalar()
        return (max_sequence or 0) + 1

    def create_design(
        self,
        *,
        user_id: int,
        design_code: str,
        sequence_number: int,
        name: str,
        jewellery_type: Optional[str] = None,
        user_prompt: Optional[str] = None,
        input_image_url: Optional[str] = None,
        status: DesignStatus = DesignStatus.DRAFT,
    ) -> Design:
        design = Design(
            user_id=user_id,
            design_code=design_code,
            sequence_number=sequence_number,
            name=name,
            jewellery_type=jewellery_type,
            user_prompt=user_prompt,
            input_image_url=input_image_url,
            status=status,
        )
        self.db.add(design)
        self.db.commit()
        self.db.refresh(design)
        return design

    def get_by_id(self, design_id: int) -> Optional[Design]:
        return self.db.query(Design).filter(Design.id == design_id).first()

    def get_by_id_for_user(self, design_id: int, user_id: int) -> Optional[Design]:
        return (
            self.db.query(Design)
            .filter(Design.id == design_id, Design.user_id == user_id)
            .first()
        )

    def get_by_code(self, design_code: str) -> Optional[Design]:
        return self.db.query(Design).filter(Design.design_code == design_code).first()

    def list_by_user(
        self,
        user_id: int,
        *,
        status: Optional[DesignStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Design]:
        query = self.db.query(Design).filter(Design.user_id == user_id)
        if status:
            query = query.filter(Design.status == status)
        return query.order_by(Design.created_at.desc()).offset(offset).limit(limit).all()

    def count_by_user(
        self,
        user_id: int,
        *,
        status: Optional[DesignStatus] = None,
    ) -> int:
        query = self.db.query(func.count(Design.id)).filter(Design.user_id == user_id)
        if status:
            query = query.filter(Design.status == status)
        return query.scalar() or 0

    def update_design(self, design: Design, **kwargs) -> Design:
        for field, value in kwargs.items():
            if hasattr(design, field) and value is not None:
                setattr(design, field, value)
        self.db.commit()
        self.db.refresh(design)
        return design

    def delete(self, design: Design) -> None:
        self.db.delete(design)
        self.db.commit()