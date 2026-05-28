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

    def _generate_design_code(self, owner_user: User, owner_id: int) -> tuple[str, int]:
        if getattr(owner_user, "business_name", None):
            words = [word for word in owner_user.business_name.split() if word]
            prefix = "".join(word[0] for word in words[:2]).upper()
        elif owner_user.design_prefix:
            prefix = owner_user.design_prefix.strip().upper()
        elif owner_user.full_name:
            words = [word for word in owner_user.full_name.split() if word]
            prefix = "".join(word[0] for word in words[:2]).upper()
        else:
            prefix = (owner_user.username or "DSN").upper()

        prefix = "".join(ch for ch in prefix if ch.isalnum())
        prefix = prefix[:3].ljust(3, "X")

        sequence_number = self.design_repo.get_next_sequence_number(owner_id)
        design_code = f"{prefix}-{sequence_number:03d}"
        return design_code, sequence_number

    def _resolve_owner_id(self, user: User) -> tuple[int, Optional[int]]:
        """
        Resolve the effective owner user_id and the created_by_user_id.
        
        For team members: user_id = team_owner_id (who owns the workspace), 
        created_by_user_id = current user (actual creator).
        For regular users: user_id = current user, created_by_user_id = None.
        """
        if user.is_team_member and user.team_owner_id:
            return user.team_owner_id, user.id
        return user.id, None

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
        owner_id, created_by_id = self._resolve_owner_id(user)
        # Fetch the actual owner user to generate the design code prefix from their account
        owner_user = user
        if owner_id != user.id:
            from app.repositories.user import UserRepository
            owner_user = UserRepository(self.db).get_user_by_id(owner_id)

        design_code, sequence_number = self._generate_design_code(owner_user, owner_id)
        design = self.design_repo.create_design(
            user_id=owner_id,
            created_by_user_id=created_by_id,
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
        """Get design for a regular user (checks user_id matches)."""
        return self.design_repo.get_by_id_for_user(design_id, user_id)

    def get_design_for_team_member(self, *, design_id: int, user: User) -> Optional[Design]:
        """
        Get design for a team member.
        Team members can see designs where user_id = team_owner_id 
        AND (created_by_user_id = their id OR any team design).
        """
        if not user.is_team_member or not user.team_owner_id:
            return self.design_repo.get_by_id_for_user(design_id, user.id)
        return self.design_repo.get_by_id_for_team_member(design_id, user.id, user.team_owner_id)

    def list_designs(
        self,
        *,
        user: User,
        status: Optional[DesignStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Design], int]:
        """
        List designs based on user type:
        - Regular user: just their own designs
        - Team member: only designs they created (for "my designs" view)
        - Team owner: all designs owned by them (including team member creations)
        """
        if user.is_team_member and user.team_owner_id:
            # Team member: only see designs they personally created
            items = self.design_repo.list_by_created_by(
                user.id, user.team_owner_id,
                status=status, limit=limit, offset=offset
            )
            total = self.design_repo.count_by_created_by(user.id, user.team_owner_id, status=status)
        else:
            # Regular user or team owner: see all designs where user_id matches
            items = self.design_repo.list_by_user(user.id, status=status, limit=limit, offset=offset)
            total = self.design_repo.count_by_user(user.id, status=status)
        return items, total

    def list_archived_designs(self, *, limit: int = 50, offset: int = 0):
        return self.design_repo.list_archived(limit=limit, offset=offset)

    def count_archived_designs(self) -> int:
        return self.design_repo.count_archived()

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
            metadata={"is_deleted": True},
        )

    def archive_design(self, design: Design, *, user: Optional[User] = None, message: Optional[str] = None) -> Design:
        archived = self.design_repo.update_design(design, is_archived=True)
        if user or message:
            self.activity_repo.log(
                design_id=design.id,
                user_id=user.id if user else None,
                action_type="DESIGN_ARCHIVED",
                message=message or f"Design {design.design_code} archived",
                metadata={"is_archived": True},
            )
        return archived

    def restore_design(self, design: Design, *, user: Optional[User] = None, message: Optional[str] = None) -> Design:
        restored = self.design_repo.update_design(design, is_archived=False)
        if user or message:
            self.activity_repo.log(
                design_id=design.id,
                user_id=user.id if user else None,
                action_type="DESIGN_RESTORED",
                message=message or f"Design {design.design_code} restored",
                metadata={"is_archived": False},
            )
        return restored