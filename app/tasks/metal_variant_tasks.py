"""
Celery task for generating metal variant images in the background.

Each requested metal (e.g. "rose_gold", "silver", "gold") is rendered using
OpenAI's image-edit API with the variant's base image as reference.  Generated
images are uploaded to Supabase and the variant's ``metal_variations_json`` is
updated with a mapping like ``{"rose_gold": "<url>", "silver": "<url>"}``.
"""

from __future__ import annotations

import base64
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import requests

from app.core.database import SessionLocal
from app.models.design import Design
from app.models.design import DesignVariant
from app.repositories.design_variant import DesignVariantRepository
from app.repositories.activity_log import DesignActivityLogRepository
from app.services.openai_service import openai_service, generate_with_openai_image, download_reference_images
from app.services.storage_service import _validate_image_bytes, upload_image_to_supabase
from app.core.sse_manager import sse_manager
from app.tasks.base import create_task

logger = logging.getLogger(__name__)


METAL_DESCRIPTIONS = {
    "gold": "rich warm yellow gold (bright golden color)",
    "yellow_gold": "rich warm yellow gold (bright golden color)",
    "white_gold": "bright white gold (cool silvery-white color)",
    "rose_gold": "warm rose gold (soft pink-copper color)",
    "rose": "warm rose gold (soft pink-copper color)",
    "silver": "bright polished silver (cool silvery-white color)",
    "platinum": "bright platinum (cool silvery-white, slightly matte luxury finish)",
}


def _build_metal_variant_prompt(metal: str, jewellery_type: str = "pendant") -> str:
    """Build a concise metal variant prompt — minimal like ChatGPT for best results."""
    metal_desc = METAL_DESCRIPTIONS.get(metal, f"{metal.replace('_', ' ').title()} metal with a high-polish finish")

    # gpt-image-2 struggles to convert a YELLOW-GOLD piece to a WHITE metal (it leaves gold
    # tones). For white metals, force a complete white conversion with NO warm tones left.
    white_clause = ""
    if metal in ("silver", "white_gold", "platinum"):
        white_clause = (
            "\n\nCRITICAL — FULL WHITE-METAL CONVERSION: the reference piece is YELLOW GOLD. Convert EVERY metal "
            "surface — the whole frame, every letter/number body, prong, bezel, border, edge, channel wall, the "
            "bail and the back — to a BRIGHT, COOL, SILVERY-WHITE metal (white gold / rhodium / platinum / silver). "
            "There must be absolutely NO yellow, NO gold, NO brass, NO warm or champagne tint left ANYWHERE on the "
            "metal surfaces — not even a faint one. 100% of the metal must read as clean white/silver. "
            "Note: This ONLY applies to the metal; do NOT remove the red, pink, or green colors from any colored gemstones. "
            "All colored gemstones must retain their original bright, vibrant colors exactly. Do NOT leave any part of the metal gold-coloured."
        )

    return f"""Recolor the metal of this {jewellery_type} to {metal_desc}. Change the metal color completely to this new color, including all metal surfaces, prongs, and settings.{white_clause}

CRITICAL STONE PROTECTION: Do NOT change the color, shape, position, or type of any gemstones. All gemstones (including clear diamonds and colored stones like green, red, pink, blue, etc.) must preserve their original color, vibrancy, saturation, and transparency exactly as seen in the reference image. Do NOT recolor, desaturate, or turn colored gems into white/silver or metal.

Keep EVERYTHING else exactly the same — same overall design, same components, same shape and silhouette, same proportions, same stones (count, cut, arrangement and setting), same engraving/text, same borders and edges, same structure, same viewpoint. Only the metal COLOR changes; do not redesign or alter any other part.

Render it as a clean CAD-style 3D jewelry render (crisp, sharp, accurate metal and stones, even studio lighting) — NOT a lifestyle photo, NOT a cartoon, no background scene. Pure solid white background (#FFFFFF).

One image only."""


def _extract_image_data(data_item: Any) -> tuple[bytes, str]:
    """Extract image bytes and content-type from an OpenAI API response item."""
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


@create_task(name="generate_metal_variant_images", max_retries=3)
def generate_metal_variant_images(
    self,
    variant_id: int,
    metals: list[str],
    channel: str,
):
    """
    Generate metal-variant images for *variant_id* for each metal in *metals*.

    The Celery task runs in a separate worker process.  Results are published
    as SSE events on *channel* when generation is complete (or fails).
    """
    logger.info(
        "Starting metal variant generation for variant_id=%s, metals=%s",
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

        base_image_url = variant.base_design_image_url
        if not base_image_url:
            raise ValueError(f"Variant {variant_id} has no base image URL")

        # Look up jewellery_type from the associated Design
        design = db.query(Design).filter(Design.id == variant.design_id).first()
        jewellery_type = design.jewellery_type if design else ""

        # Preserve existing metal variations that were not requested
        existing_metal_variations = variant.metal_variations_json or {}
        metal_variations: dict[str, str] = {}

        # Keep all existing metals that weren't requested (never remove old data)
        for existing_metal, existing_url in existing_metal_variations.items():
            if existing_metal not in metals:
                metal_variations[existing_metal] = existing_url

        # Determine which requested metals already exist (skip regeneration)
        already_existing = [m for m in metals if m in existing_metal_variations and existing_metal_variations[m] is not None]
        missing_metals = [m for m in metals if m not in existing_metal_variations or existing_metal_variations[m] is None]

        if already_existing:
            logger.info(
                "Skipping already-existing metals for variant_id=%s: %s",
                variant_id, already_existing,
            )
            # Preserve existing data for metals that already have it
            for metal in already_existing:
                metal_variations[metal] = existing_metal_variations[metal]

        if not missing_metals:
            sse_manager.publish(
                channel,
                data={
                    "variant_id": variant.id,
                    "design_id": variant.design_id,
                    "status": "SKIPPED",
                    "message": "All requested metals already exist",
                    "metal_variations": metal_variations,
                },
                event="metal_variants.generated",
            )
            sse_manager.publish_close(channel)
            return

        # Pre-download reference image ONCE — shared across all parallel threads
        cached_blobs = download_reference_images([base_image_url])
        logger.info("Reference image pre-downloaded (%d bytes) for parallel metal generation", sum(len(b) for b in cached_blobs))

        def _generate_single_metal(metal: str) -> tuple[str, str | None]:
            """Generate a single metal variant. Returns (metal, image_url or None)."""
            logger.info("Generating %s variant for variant_id=%s", metal, variant_id)
            try:
                prompt = _build_metal_variant_prompt(metal, jewellery_type)
                b64_json = generate_with_openai_image([base_image_url], prompt, pre_downloaded_blobs=cached_blobs)
                image_bytes = base64.b64decode(b64_json)
                content_type = "image/png"
                _validate_image_bytes(image_bytes, content_type)

                bucket_path = f"generated/metal_variants/{variant.design_id}/{variant_id}/{metal}"
                image_url = upload_image_to_supabase(image_bytes, bucket_path)
                logger.info(
                    "%s variant generated for variant_id=%s: %s",
                    metal, variant_id, image_url,
                )
                return metal, image_url
            except Exception as exc:
                logger.exception(
                    "Failed to generate %s variant for variant_id=%s: %s",
                    metal, variant_id, exc,
                )
                return metal, None

        # Run all metal generations in parallel (I/O-bound — waiting on OpenAI API)
        max_parallel = min(len(missing_metals), 4)
        with ThreadPoolExecutor(max_workers=max_parallel) as executor:
            futures = {
                executor.submit(_generate_single_metal, metal): metal
                for metal in missing_metals
            }
            for future in as_completed(futures):
                metal_name, image_url = future.result()
                metal_variations[metal_name] = image_url

        # Update the variant's metal_variations_json with merged data
        # (preserves old metals + adds newly generated ones)
        updated = variant_repo.update_variant(
            variant,
            metal_variations_json=metal_variations,
        )
        activity_repo.log(
            design_id=variant.design_id,
            action_type="METAL_VARIANTS_GENERATED",
            message=f"Metal variations generated: {', '.join(metals)}",
            metadata={"variant_id": variant.id, "metals": list(metal_variations.keys())},
        )

        sse_manager.publish(
            channel,
            data={
                "variant_id": variant.id,
                "design_id": variant.design_id,
                "status": "GENERATED",
                "metal_variations": metal_variations,
            },
            event="metal_variants.generated",
        )

        sse_manager.publish_close(channel)

        logger.info(
            "Metal variant generation completed for variant_id=%s",
            variant_id,
        )

    except Exception as exc:
        logger.exception(
            "Metal variant generation failed for variant_id=%s: %s",
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
                event="metal_variants.failed",
            )
            sse_manager.publish_close(channel)
        except Exception:
            logger.warning(
                "Failed to publish SSE failure event for variant_id=%s",
                variant_id,
            )

        raise self.retry(
            exc=exc,
            countdown=60 * (2**self.request.retries),
            max_retries=3,
        )

    finally:
        db.close()