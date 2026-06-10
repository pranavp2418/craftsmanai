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
        created_by_user_id: Optional[int] = None,
        design_code: str,
        sequence_number: int,
        name: str,
        jewellery_type: Optional[str] = None,
        user_prompt: Optional[str] = None,
        input_image_url: Optional[str] = None,
        input_image_urls: Optional[list[str]] = None,
        status: DesignStatus = DesignStatus.DRAFT,
    ) -> Design:
        design = Design(
            user_id=user_id,
            created_by_user_id=created_by_user_id,
            design_code=design_code,
            sequence_number=sequence_number,
            name=name,
            jewellery_type=jewellery_type,
            user_prompt=user_prompt,
            input_image_url=input_image_url,
            input_image_urls=input_image_urls,
            status=status,
        )
        self.db.add(design)
        self.db.commit()
        self.db.refresh(design)
        return design

    def get_by_id(self, design_id: int) -> Optional[Design]:
        return self.db.query(Design).filter(Design.id == design_id, Design.is_deleted.is_(False)).first()

    def get_by_id_for_user(self, design_id: int, user_id: int) -> Optional[Design]:
        """Get design by ID allowing team members to see designs owned by their team owner."""
        return (
            self.db.query(Design)
            .filter(
                Design.id == design_id,
                Design.user_id == user_id,
                Design.is_deleted.is_(False),
            )
            .first()
        )

    def get_by_id_for_team_member(self, design_id: int, user_id: int, team_owner_id: int) -> Optional[Design]:
        """Get design accessible to a team member - either owned by their team owner or created by them."""
        return (
            self.db.query(Design)
            .filter(
                Design.id == design_id,
                Design.user_id == team_owner_id,
                Design.created_by_user_id == user_id,
                Design.is_deleted.is_(False),
            )
            .first()
        )

    def list_archived(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Design]:
        return (
            self.db.query(Design)
            .filter(Design.is_archived.is_(True), Design.is_deleted.is_(False))
            .order_by(Design.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def count_archived(self) -> int:
        return (
            self.db.query(func.count(Design.id))
            .filter(Design.is_archived.is_(True), Design.is_deleted.is_(False))
            .scalar()
            or 0
        )
    def get_by_code(self, design_code: str) -> Optional[Design]:
        return self.db.query(Design).filter(Design.design_code == design_code, Design.is_deleted.is_(False)).first()

    def list_by_user(
        self,
        user_id: int,
        *,
        status: Optional[DesignStatus] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Design]:
        query = self.db.query(Design).filter(Design.user_id == user_id, Design.is_archived.is_(False), Design.is_deleted.is_(False))
        if status:
            query = query.filter(Design.status == status)
        if search:
            query = query.filter(Design.design_code.ilike(f"%{search.strip()}%"))
        return query.order_by(Design.created_at.desc()).offset(offset).limit(limit).all()

    def list_by_team_owner(
        self,
        team_owner_id: int,
        *,
        status: Optional[DesignStatus] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Design]:
        """List all designs owned by a team owner, including those created by team members."""
        query = self.db.query(Design).filter(Design.user_id == team_owner_id, Design.is_archived.is_(False), Design.is_deleted.is_(False))
        if status:
            query = query.filter(Design.status == status)
        if search:
            query = query.filter(Design.design_code.ilike(f"%{search.strip()}%"))
        return query.order_by(Design.created_at.desc()).offset(offset).limit(limit).all()

    def list_by_created_by(
        self,
        user_id: int,
        team_owner_id: int,
        *,
        status: Optional[DesignStatus] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Design]:
        """List designs created by a specific team member (for their "my designs" view)."""
        query = self.db.query(Design).filter(
            Design.user_id == team_owner_id,
            Design.created_by_user_id == user_id,
            Design.is_archived.is_(False),
            Design.is_deleted.is_(False),
        )
        if status:
            query = query.filter(Design.status == status)
        if search:
            query = query.filter(Design.design_code.ilike(f"%{search.strip()}%"))
        return query.order_by(Design.created_at.desc()).offset(offset).limit(limit).all()

    def count_by_user(
        self,
        user_id: int,
        *,
        status: Optional[DesignStatus] = None,
        search: Optional[str] = None,
    ) -> int:
        query = self.db.query(func.count(Design.id)).filter(Design.user_id == user_id, Design.is_archived.is_(False), Design.is_deleted.is_(False))
        if status:
            query = query.filter(Design.status == status)
        if search:
            query = query.filter(Design.design_code.ilike(f"%{search.strip()}%"))
        return query.scalar() or 0

    def count_by_team_owner(
        self,
        team_owner_id: int,
        *,
        status: Optional[DesignStatus] = None,
        search: Optional[str] = None,
    ) -> int:
        """Count all designs owned by a team owner."""
        query = self.db.query(func.count(Design.id)).filter(Design.user_id == team_owner_id, Design.is_archived.is_(False), Design.is_deleted.is_(False))
        if status:
            query = query.filter(Design.status == status)
        if search:
            query = query.filter(Design.design_code.ilike(f"%{search.strip()}%"))
        return query.scalar() or 0

    def count_by_created_by(
        self,
        user_id: int,
        team_owner_id: int,
        *,
        status: Optional[DesignStatus] = None,
        search: Optional[str] = None,
    ) -> int:
        """Count designs created by a specific team member."""
        query = self.db.query(func.count(Design.id)).filter(
            Design.user_id == team_owner_id,
            Design.created_by_user_id == user_id,
            Design.is_archived.is_(False),
            Design.is_deleted.is_(False),
        )
        if status:
            query = query.filter(Design.status == status)
        if search:
            query = query.filter(Design.design_code.ilike(f"%{search.strip()}%"))
        return query.scalar() or 0

    def update_design(self, design: Design, **kwargs) -> Design:
        for field, value in kwargs.items():
            if hasattr(design, field) and value is not None:
                setattr(design, field, value)
        self.db.commit()
        self.db.refresh(design)
        return design

    def delete(self, design: Design) -> None:
        design.is_deleted = True
        self.db.commit()
        self.db.refresh(design)