from typing import Optional

from sqlalchemy.orm import Session

from app.models.design import DesignVariant
from app.repositories.design_variant import DesignVariantRepository
from app.repositories.activity_log import DesignActivityLogRepository


class DesignVariantService:
    def __init__(self, db: Session):
        self.db = db
        self.variant_repo = DesignVariantRepository(db)
        self.activity_repo = DesignActivityLogRepository(db)

    def _next_version(self, design_id: int) -> int:
        variants = self.variant_repo.list_for_design(design_id)
        return (max((variant.version_number for variant in variants), default=-1) + 1)

    def get_variant(self, variant_id: int) -> Optional[DesignVariant]:
        return self.variant_repo.get_by_id(variant_id)

    def list_variants(self, design_id: int, skip: Optional[int] = None, limit: Optional[int] = None):
        return self.variant_repo.list_for_design(design_id, skip=skip, limit=limit)

    def count_variants(self, design_id: int) -> int:
        return self.variant_repo.count_for_design(design_id)

    def list_archived_variants(self, user_id: int, skip: Optional[int] = None, limit: Optional[int] = None):
        return self.variant_repo.list_archived_for_user(user_id, skip=skip, limit=limit)

    def count_archived_variants(self, user_id: int) -> int:
        return self.variant_repo.count_archived_for_user(user_id)

    def create_initial_variant(
        self,
        *,
        design_id: int,
        base_design_image_url: Optional[str] = None,
        prompt_used: Optional[str] = None,
        model_used: Optional[str] = None,
    ) -> DesignVariant:
        variant = self.variant_repo.create_variant(
            design_id=design_id,
            variant_name="v0",
            version_number=0,
            base_design_image_url=base_design_image_url,
            prompt_used=prompt_used,
            model_used=model_used,
            is_selected=True,
        )
        self.variant_repo.clear_selected(design_id)
        self.variant_repo.set_selected(variant, selected=True)
        self.activity_repo.log(
            design_id=design_id,
            action_type="VARIANT_GENERATED",
            message="Initial variant generated",
            metadata={"variant_id": variant.id, "version": 0},
        )
        return variant

    def refine_variant(
        self,
        *,
        design_id: int,
        parent_variant_id: int,
        prompt_used: Optional[str] = None,
        model_used: Optional[str] = None,
        base_design_image_url: Optional[str] = None,
        style_tags: Optional[str] = None,
        design_focus: Optional[str] = None,
    ) -> DesignVariant:
        version = self._next_version(design_id)
        variant = self.variant_repo.create_variant(
            design_id=design_id,
            parent_variant_id=parent_variant_id,
            variant_name=f"v{version}",
            version_number=version,
            prompt_used=prompt_used,
            model_used=model_used,
            base_design_image_url=base_design_image_url,
            style_tags=style_tags,
            design_focus=design_focus,
        )
        self.activity_repo.log(
            design_id=design_id,
            action_type="VARIANT_GENERATED",
            message="Variant refinement generated",
            metadata={"variant_id": variant.id, "version": version, "parent_variant_id": parent_variant_id},
        )
        return variant

    def generate_angles(self, variant: DesignVariant, *, angles: dict) -> DesignVariant:
        updated = self.variant_repo.update_variant(variant, angles_json=angles)
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="ANGLES_GENERATED",
            message="Rendered additional viewing angles",
            metadata={"variant_id": variant.id},
        )
        return updated

    def generate_metal_variations(self, variant: DesignVariant, *, metal_variations: dict) -> DesignVariant:
        updated = self.variant_repo.update_variant(variant, metal_variations_json=metal_variations)
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="METAL_VARIANTS_GENERATED",
            message="Metal variations generated",
            metadata={"variant_id": variant.id},
        )
        return updated

    def select_variant(self, variant: DesignVariant, *, message: Optional[str] = None) -> DesignVariant:
        self.variant_repo.clear_selected(variant.design_id)
        selected = self.variant_repo.set_selected(variant, selected=True)
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="VARIANT_SELECTED",
            message=message or f"Variant {variant.variant_name} selected",
            metadata={"variant_id": variant.id},
        )
        return selected

    def archive_variant(self, variant: DesignVariant, *, message: Optional[str] = None) -> DesignVariant:
        archived = self.variant_repo.update_variant(variant, is_archived=True)
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="VARIANT_ARCHIVED",
            message=message or f"Variant {variant.variant_name} archived",
            metadata={"variant_id": variant.id, "is_archived": True},
        )
        return archived

    def restore_variant(self, variant: DesignVariant, *, message: Optional[str] = None) -> DesignVariant:
        restored = self.variant_repo.update_variant(variant, is_archived=False)
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="VARIANT_RESTORED",
            message=message or f"Variant {variant.variant_name} restored",
            metadata={"variant_id": variant.id, "is_archived": False},
        )
        return restored

    def delete_variant(self, variant: DesignVariant, *, message: Optional[str] = None) -> DesignVariant:
        deleted = self.variant_repo.delete_variant(variant)
        self.activity_repo.log(
            design_id=variant.design_id,
            action_type="VARIANT_DELETED",
            message=message or f"Variant {variant.variant_name} deleted",
            metadata={"variant_id": variant.id, "is_deleted": True},
        )
        return deleted