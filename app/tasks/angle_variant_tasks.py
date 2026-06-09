"""
Celery task for generating viewing angles per metal type for a design variant.

The task accepts a list of metals (e.g. ``["gold", "silver", "rose"]``).
For each metal it generates all standard viewing angles (side_view, top_view,
three_quarter_view) using the variant's base image as reference.  The results
are stored as a nested dict under ``angles_json``:

.. code-block:: json

    {
      "gold": {
        "side_view": "https://...",
        "top_view": "https://...",
        "three_quarter_view": "https://..."
      },
      "silver": { ... },
      "rose": { ... }
    }
"""

from __future__ import annotations

import base64
import logging
from typing import Any

import requests

from app.core.database import SessionLocal
from app.models.design import Design
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


def _metal_to_angle_prompt_suffix(metal: str) -> str:
    """Return a rendering hint suffix for the given metal to be appended to the angle prompt."""
    metal_hints = {
        "gold": "Render the jewelry in 18K yellow gold with warm golden reflections and high-polish finish.",
        "rose": "Render the jewelry in 18K rose gold with a pinkish-warm hue and high-polish finish.",
        "silver": "Render the jewelry in sterling silver / white gold with cool, bright reflections and high-polish finish.",
        "platinum": "Render the jewelry in platinum with a bright white lustre and slightly matte luxury finish.",
        "white_gold": "Render the jewelry in 18K white gold with a bright white tone and rhodium-plated shine.",
    }
    return metal_hints.get(
        metal,
        f"Render the jewelry in {metal.replace('_', ' ').title()} metal with a high-polish finish.",
    )


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
def generate_remaining_variant_angles(self, variant_id: int, metals: list[str], channel: str):
    """Generate viewing angles for each requested metal for *variant_id*.

    The Celery task runs in a separate worker process.  Results are published
    as SSE events on *channel* when generation is complete (or fails).
    """
    logger.info(
        "Starting per-metal angle generation for variant_id=%s, metals=%s",
        variant_id,
        metals,
    )
    db = SessionLocal()

    try:
        variant_repo = DesignVariantRepository(db)
        activity_repo = DesignActivityLogRepository(db)

        variant = variant_repo.get_by_id(variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {variant_id} not found")

        if not variant.base_design_image_url:
            raise ValueError(f"Variant {variant_id} has no base image URL")

        # Look up jewellery_type from the associated Design
        design = db.query(Design).filter(Design.id == variant.design_id).first()
        jewellery_type = design.jewellery_type if design else ""

        # Build nested angles_json: keys are metal names, values are angle dicts
        existing_angles = variant.angles_json or {}
        generated_angles: dict[str, dict[str, str]] = {}

        # Preserve ALL existing metals that were NOT requested (never remove old data)
        for existing_metal, existing_metal_data in existing_angles.items():
            if existing_metal not in metals:
                generated_angles[existing_metal] = existing_metal_data

        # Determine which requested metals already have all angles (skip regeneration)
        already_existing = []
        for metal_name in metals:
            metal_data = existing_angles.get(metal_name)
            if isinstance(metal_data, dict) and all(
                angle in metal_data for angle in ANGLE_PROMPTS.keys()
            ):
                already_existing.append(metal_name)
                generated_angles[metal_name] = metal_data

        missing_metals = [m for m in metals if m not in already_existing]

        if already_existing:
            logger.info(
                "Skipping already-existing angle metals for variant_id=%s: %s",
                variant_id, already_existing,
            )

        if not missing_metals:
            sse_manager.publish(
                channel,
                data={
                    "variant_id": variant.id,
                    "design_id": variant.design_id,
                    "status": "SKIPPED",
                    "message": "All angles already exist for all requested metals",
                    "angles": generated_angles,
                },
                event="variant.angles.generated",
            )
            sse_manager.publish_close(channel)
            return

        for metal_name in missing_metals:
            logger.info(
                "Generating angles for metal=%s, variant_id=%s",
                metal_name,
                variant_id,
            )
            metal_angles: dict[str, str] = {}

            for angle_name, base_prompt in ANGLE_PROMPTS.items():
                # Combine the angle description with the metal rendering hint
                metal_hint = _metal_to_angle_prompt_suffix(metal_name)
                full_prompt = f"{base_prompt}\n\n{metal_hint}"
                logger.info(
                    "Generating %s for metal=%s, variant_id=%s",
                    angle_name,
                    metal_name,
                    variant_id,
                )

                # Map metal_name to standard values expected by openai_service
                norm_metal = "yellow_gold"
                if metal_name in ("rose", "rose_gold"):
                    norm_metal = "rose_gold"
                elif metal_name in ("silver", "white_gold"):
                    norm_metal = "white_gold"
                elif metal_name in ("gold", "yellow_gold"):
                    norm_metal = "yellow_gold"
                elif metal_name == "platinum":
                    norm_metal = "platinum"

                if angle_name == "side_view":
                    generated_item = openai_service.generate_side_view(
                        base_image_source=variant.base_design_image_url,
                        angle_description=full_prompt,
                        jewellery_type=jewellery_type,
                        metal_tone=norm_metal,
                    )
                elif angle_name == "top_view":
                    generated_item = openai_service.generate_top_view(
                        base_image_source=variant.base_design_image_url,
                        angle_description=full_prompt,
                        jewellery_type=jewellery_type,
                        metal_tone=norm_metal,
                    )
                else:
                    generated_item = openai_service.generate_custom_angle(
                        base_image_source=variant.base_design_image_url,
                        angle_description=full_prompt,
                        jewellery_type=jewellery_type,
                        metal_tone=norm_metal,
                    )

                image_bytes, content_type = _extract_image_data(generated_item)
                _validate_image_bytes(image_bytes, content_type)

                # Include metal in the storage path to prevent collisions
                bucket_path = (
                    f"generated/angles/{variant.design_id}/{variant.id}/"
                    f"{metal_name}/{angle_name}"
                )
                image_url = upload_image_to_supabase(image_bytes, bucket_path)
                metal_angles[angle_name] = image_url

            generated_angles[metal_name] = metal_angles

        # Merge back any metals that weren't requested but existed before
        for existing_metal, existing_metal_data in existing_angles.items():
            if existing_metal not in generated_angles:
                generated_angles[existing_metal] = existing_metal_data

        variant_repo.update_variant(variant, angles_json=generated_angles)
        activity_repo.log(
            design_id=variant.design_id,
            action_type="ANGLES_GENERATED",
            message=f"Generated angles for metals: {', '.join(missing_metals)}",
            metadata={
                "variant_id": variant.id,
                "metals": missing_metals,
            },
        )

        sse_manager.publish(
            channel,
            data={
                "variant_id": variant.id,
                "design_id": variant.design_id,
                "status": "GENERATED",
                "generated_metals": missing_metals,
                "angles": generated_angles,
            },
            event="variant.angles.generated",
        )

        sse_manager.publish_close(channel)

        logger.info(
            "Per-metal angle generation completed for variant_id=%s",
            variant_id,
        )

    except Exception as exc:
        logger.exception(
            "Per-metal angle generation failed for variant_id=%s: %s",
            variant_id,
            exc,
        )
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
            sse_manager.publish_close(channel)
        except Exception:
            logger.warning(
                "Failed to publish angle generation failure event for variant_id=%s",
                variant_id,
            )

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3,
        )
    finally:
        db.close()