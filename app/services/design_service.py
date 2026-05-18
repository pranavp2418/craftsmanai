from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.design import Design, DesignStatus
from app.models.user import User
from app.repositories.design import DesignRepository
from app.repositories.activity_log import DesignActivityLogRepository


class DesignService:
    """High-level orchestration for design lifecycle management."""

    def __init__(self, db: Session):
        self.db = db
        self.design_repo = DesignRepository(db)
        self.activity_repo = DesignActivityLogRepository(db)

    def _generate_design_code(self, user: User) -> tuple[str, int]:
        if getattr(user, "business_name", None):
            words = [word for word in user.business_name.split() if word]
            prefix = "".join(word[0] for word in words[:2]).upper()
        elif user.design_prefix:
            prefix = user.design_prefix.strip().upper()
        elif user.full_name:
            words = [word for word in user.full_name.split() if word]
            prefix = "".join(word[0] for word in words[:2]).upper()
        else:
            prefix = (user.username or "DSN").upper()

        prefix = "".join(ch for ch in prefix if ch.isalnum())
        prefix = prefix[:3].ljust(3, "X")

        sequence_number = self.design_repo.get_next_sequence_number(user.id)
        design_code = f"{prefix}-{sequence_number:03d}"
        return design_code, sequence_number

    def create_design(
        self,
        *,
        user: User,
        name: str,
        jewellery_type: Optional[str] = None,
        user_prompt: Optional[str] = None,
        input_image_url: Optional[str] = None,
        input_image_urls: Optional[list[str]] = None,
        initial_prompt: Optional[str] = None,
        initial_model: Optional[str] = None,
        initial_image_url: Optional[str] = None,
    ) -> Design:
        design_code, sequence_number = self._generate_design_code(user)
        design = self.design_repo.create_design(
            user_id=user.id,
            design_code=design_code,
            sequence_number=sequence_number,
            name=name,
            jewellery_type=jewellery_type,
            user_prompt=user_prompt,
            input_image_url=input_image_url,
            input_image_urls=input_image_urls,
        )
        self.activity_repo.log(
            design_id=design.id,
            user_id=user.id,
            action_type="DESIGN_CREATED",
            message=f"Design {design.design_code} created",
        )
        return design

    def get_design(self, design_id: int) -> Optional[Design]:
        return self.design_repo.get_by_id(design_id)

    def get_design_for_user(self, *, design_id: int, user_id: int) -> Optional[Design]:
        return self.design_repo.get_by_id_for_user(design_id, user_id)

    def list_designs(
        self,
        *,
        user_id: int,
        status: Optional[DesignStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Design], int]:
        items = self.design_repo.list_by_user(user_id, status=status, limit=limit, offset=offset)
        total = self.design_repo.count_by_user(user_id, status=status)
        return items, total

    def update_design(
        self,
        design: Design,
        *,
        name: Optional[str] = None,
        jewellery_type: Optional[str] = None,
        user_prompt: Optional[str] = None,
        input_image_url: Optional[str] = None,
        status: Optional[DesignStatus] = None,
        user: Optional[User] = None,
        message: Optional[str] = None,
    ) -> Design:
        updated = self.design_repo.update_design(
            design,
            name=name,
            jewellery_type=jewellery_type,
            user_prompt=user_prompt,
            input_image_url=input_image_url,
            status=status,
        )
        if user or message:
            self.activity_repo.log(
                design_id=design.id,
                user_id=user.id if user else None,
                action_type="STATUS_CHANGED" if status else "DESIGN_UPDATED",
                message=message,
                metadata={"status": status.value if status else None},
            )
        return updated

    def delete_design(self, design: Design) -> None:
        self.design_repo.delete(design)
        self.activity_repo.log(
            design_id=design.id,
            action_type="DESIGN_DELETED",
            message=f"Design {design.design_code} deleted",
        )