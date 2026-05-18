"""
Celery task for generating the remaining viewing angles for a design variant.

This task treats the base image as the primary/front view and generates the
three remaining standard angles:
  - side_view
  - top_view
  - three_quarter_view
"""

from __future__ import annotations

import base64
import logging
from typing import Any

import requests

from app.core.database import SessionLocal
from app.repositories.design_variant import DesignVariantRepository
from app.repositories.activity_log import DesignActivityLogRepository
from app.services.openai_service import openai_service
from app.services.storage_service import _validate_image_bytes, upload_image_to_supabase
from app.core.sse_manager import sse_manager
from app.tasks.base import create_task

logger = logging.getLogger(__name__)


ANGLE_PROMPTS = {
    "side_view": "rotate 90 degrees to the right, full side profile view, camera at same height",
    "top_view": "top-down view, camera positioned directly above at 90 degrees looking down",
    "three_quarter_view": "three-quarter perspective view (about 45 degrees), preserving full geometry and realistic depth",
}


def _extract_image_data(data_item: Any) -> tuple[bytes, str]:
    if getattr(data_item, "b64_json", None):
        return base64.b64decode(data_item.b64_json), "image/png"
    if isinstance(data_item, dict) and data_item.get("b64_json"):
        return base64.b64decode(data_item["b64_json"]), "image/png"

    url = getattr(data_item, "url", None) or (
        data_item.get("url") if isinstance(data_item, dict) else None
    )
    if url:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "").split(";")[0].strip()
        return resp.content, content_type or "image/png"

    raise ValueError("OpenAI response did not contain image bytes or URL.")


@create_task(name="generate_remaining_variant_angles", max_retries=3)
def generate_remaining_variant_angles(self, variant_id: int, channel: str):
    logger.info("Starting remaining angle generation for variant_id=%s", variant_id)
    db = SessionLocal()

    try:
        variant_repo = DesignVariantRepository(db)
        activity_repo = DesignActivityLogRepository(db)

        variant = variant_repo.get_by_id(variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {variant_id} not found")

        if not variant.base_design_image_url:
            raise ValueError(f"Variant {variant_id} has no base image URL")

        existing_angles = variant.angles_json or {}
        missing_angles = [
            angle_name
            for angle_name in ANGLE_PROMPTS.keys()
            if not existing_angles.get(angle_name)
        ]

        if not missing_angles:
            sse_manager.publish(
                channel,
                data={
                    "variant_id": variant.id,
                    "design_id": variant.design_id,
                    "status": "SKIPPED",
                    "message": "All remaining standard angles already exist",
                    "angles": existing_angles,
                },
                event="variant.angles.generated",
            )
            return

        generated_angles = dict(existing_angles)

        for angle_name in missing_angles:
            prompt = ANGLE_PROMPTS[angle_name]
            logger.info("Generating %s for variant_id=%s", angle_name, variant_id)

            if angle_name == "side_view":
                generated_item = openai_service.generate_side_view(
                    base_image_source=variant.base_design_image_url,
                    angle_description=prompt,
                )
            elif angle_name == "top_view":
                generated_item = openai_service.generate_top_view(
                    base_image_source=variant.base_design_image_url,
                    angle_description=prompt,
                )
            else:
                generated_item = openai_service.generate_custom_angle(
                    base_image_source=variant.base_design_image_url,
                    angle_description=prompt,
                )

            image_bytes, content_type = _extract_image_data(generated_item)
            _validate_image_bytes(image_bytes, content_type)

            bucket_path = f"generated/angles/{variant.design_id}/{variant.id}/{angle_name}"
            image_url = upload_image_to_supabase(image_bytes, bucket_path)
            generated_angles[angle_name] = image_url

        variant_repo.update_variant(variant, angles_json=generated_angles)
        activity_repo.log(
            design_id=variant.design_id,
            action_type="ANGLES_GENERATED",
            message="Generated remaining variant angles",
            metadata={"variant_id": variant.id, "generated_angles": missing_angles},
        )

        sse_manager.publish(
            channel,
            data={
                "variant_id": variant.id,
                "design_id": variant.design_id,
                "status": "GENERATED",
                "generated_angles": missing_angles,
                "angles": generated_angles,
            },
            event="variant.angles.generated",
        )

        logger.info("Remaining angle generation completed for variant_id=%s", variant_id)

    except Exception as exc:
        logger.exception("Remaining angle generation failed for variant_id=%s: %s", variant_id, exc)
        try:
            sse_manager.publish(
                channel,
                data={
                    "variant_id": variant_id,
                    "status": "FAILED",
                    "error": str(exc),
                },
                event="variant.angles.failed",
            )
        except Exception:
            logger.warning("Failed to publish angle generation failure event for variant_id=%s", variant_id)

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3,
        )
    finally:
        db.close()
