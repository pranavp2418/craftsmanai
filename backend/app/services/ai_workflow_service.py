from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.design import Design, DesignStatus
from app.repositories.design import DesignRepository
from app.repositories.design_variant import DesignVariantRepository
from app.repositories.activity_log import DesignActivityLogRepository


class AIGenerationWorkflowService:
    """Service coordinating the AI design generation lifecycle."""

    def __init__(self, db: Session):
        self.db = db
        self.design_repo = DesignRepository(db)
        self.variant_repo = DesignVariantRepository(db)
        self.activity_repo = DesignActivityLogRepository(db)

    def start_generation(self, design: Design, *, prompt: Optional[str] = None) -> Design:
        updated = self.design_repo.update_design(
            design,
            status=DesignStatus.GENERATING,
            user_prompt=prompt or design.user_prompt,
        )
        self.activity_repo.log(
            design_id=design.id,
            action_type="STATUS_CHANGED",
            message="Generation started",
            metadata={"status": DesignStatus.GENERATING.value},
        )
        return updated

    def complete_generation(
        self,
        design: Design,
        variant_id: int,
        *,
        base_image_url: Optional[str] = None,
        prompt: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Design:
        variant = self.variant_repo.get_by_id(variant_id)
        if not variant:
            raise ValueError("Variant not found")

        self.variant_repo.update_variant(
            variant,
            base_design_image_url=base_image_url,
            prompt_used=prompt or variant.prompt_used,
            model_used=model or variant.model_used,
        )
        updated_design = self.design_repo.update_design(design, status=DesignStatus.GENERATED)
        self.activity_repo.log(
            design_id=design.id,
            action_type="VARIANT_GENERATED",
            message="Initial generation completed",
            metadata={"variant_id": variant.id},
        )
        return updated_design

    def enqueue_review(self, design: Design) -> Design:
        updated = self.design_repo.update_design(design, status=DesignStatus.UNDER_REVIEW)
        self.activity_repo.log(
            design_id=design.id,
            action_type="STATUS_CHANGED",
            message="Design moved to review",
            metadata={"status": DesignStatus.UNDER_REVIEW.value},
        )
        return updated
