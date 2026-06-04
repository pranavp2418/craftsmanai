from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.design import Design, DesignVariant


class DesignVariantRepository:
    """Repository for managing design variants and lineage."""

    def __init__(self, db: Session):
        self.db = db

    def create_variant(
        self,
        *,
        design_id: int,
        variant_name: str,
        version_number: int,
        parent_variant_id: Optional[int] = None,
        base_design_image_url: Optional[str] = None,
        angles_json: Optional[dict] = None,
        metal_variations_json: Optional[dict] = None,
        prompt_used: Optional[str] = None,
        model_used: Optional[str] = None,
        is_selected: bool = False,
        design_focus: Optional[str] = None,
        style_tags: Optional[str] = None,
        reference_images_json: Optional[list] = None,
    ) -> DesignVariant:
        variant = DesignVariant(
            design_id=design_id,
            parent_variant_id=parent_variant_id,
            variant_name=variant_name,
            version_number=version_number,
            base_design_image_url=base_design_image_url,
            angles_json=angles_json,
            metal_variations_json=metal_variations_json,
            prompt_used=prompt_used,
            model_used=model_used,
            is_selected=is_selected,
            design_focus=design_focus,
            style_tags=style_tags,
            reference_images_json=reference_images_json,
        )
        self.db.add(variant)
        self.db.commit()
        self.db.refresh(variant)
        return variant

    def get_by_id(self, variant_id: int) -> Optional[DesignVariant]:
        return self.db.query(DesignVariant).filter(DesignVariant.id == variant_id, DesignVariant.is_deleted.is_(False)).first()

    def list_for_design(self, design_id: int, skip: Optional[int] = None, limit: Optional[int] = None) -> List[DesignVariant]:
        query = (
            self.db.query(DesignVariant)
            .filter(
                DesignVariant.design_id == design_id,
                DesignVariant.is_archived.is_(False),
                DesignVariant.is_deleted.is_(False),
            )
            .order_by(DesignVariant.created_at.desc())
        )
        if skip is not None:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def count_for_design(self, design_id: int) -> int:
        return (
            self.db.query(DesignVariant)
            .filter(
                DesignVariant.design_id == design_id,
                DesignVariant.is_archived.is_(False),
                DesignVariant.is_deleted.is_(False),
            )
            .count()
        )

    def list_archived_for_user(self, user_id: int, skip: Optional[int] = None, limit: Optional[int] = None) -> List[DesignVariant]:
        query = (
            self.db.query(DesignVariant)
            .join(Design, DesignVariant.design_id == Design.id)
            .filter(
                Design.user_id == user_id,
                DesignVariant.is_archived.is_(True),
                DesignVariant.is_deleted.is_(False),
            )
            .order_by(DesignVariant.created_at.desc())
        )
        if skip is not None:
            query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def count_archived_for_user(self, user_id: int) -> int:
        return (
            self.db.query(DesignVariant)
            .join(Design, DesignVariant.design_id == Design.id)
            .filter(
                Design.user_id == user_id,
                DesignVariant.is_archived.is_(True),
                DesignVariant.is_deleted.is_(False),
            )
            .count()
        )

    def get_selected_variant(self, design_id: int) -> Optional[DesignVariant]:
        return (
            self.db.query(DesignVariant)
            .filter(
                DesignVariant.design_id == design_id,
                DesignVariant.is_selected.is_(True),
                DesignVariant.is_deleted.is_(False),
            )
            .first()
        )

    def clear_selected(self, design_id: int) -> None:
        self.db.query(DesignVariant).filter(DesignVariant.design_id == design_id).update({DesignVariant.is_selected: False})
        self.db.commit()

    def set_selected(self, variant: DesignVariant, *, selected: bool = True) -> DesignVariant:
        variant.is_selected = selected
        self.db.commit()
        self.db.refresh(variant)
        return variant

    def update_variant(self, variant: DesignVariant, **kwargs) -> DesignVariant:
        for field, value in kwargs.items():
            if hasattr(variant, field) and value is not None:
                setattr(variant, field, value)
        self.db.commit()
        self.db.refresh(variant)
        return variant

    def delete_variant(self, variant: DesignVariant) -> DesignVariant:
        variant.is_deleted = True
        self.db.commit()
        self.db.refresh(variant)
        return variant