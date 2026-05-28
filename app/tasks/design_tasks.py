"""
Design generation background tasks using Celery.
"""

import asyncio
import base64
import logging
from typing import Any

import requests

from app.core.database import SessionLocal
from app.models.design import Design
from app.services.ai_workflow_service import AIGenerationWorkflowService
from app.services.ai_workflow_v5_service import generate_jewelry_with_cross_agent
from app.services.design_variant_service import DesignVariantService
from app.services.openai_service import openai_service
from app.services.storage_service import _validate_image_bytes, upload_image_to_supabase
from app.tasks.base import create_task
from app.core.sse_manager import sse_manager

logger = logging.getLogger(__name__)


def _extract_generated_image_data(data_item: Any) -> tuple[bytes, str]:
    if getattr(data_item, "b64_json", None):
        return base64.b64decode(data_item.b64_json), "image/png"

    if isinstance(data_item, dict) and data_item.get("b64_json"):
        return base64.b64decode(data_item["b64_json"]), "image/png"

    url = getattr(data_item, "url", None) or (data_item.get("url") if isinstance(data_item, dict) else None)
    if url:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").split(";")[0].strip()
        return response.content, content_type or "image/png"

    raise ValueError("OpenAI response did not contain image bytes or URL.")


def _resolve_reference_image_url(design: Design) -> str:
    if design.input_image_urls:
        if isinstance(design.input_image_urls, list) and design.input_image_urls:
            return design.input_image_urls[0]
    if design.input_image_url:
        return design.input_image_url
    raise ValueError("No reference image URL available for generation.")


def _publish_sse(channel: str, data: dict, event: str = "design.generated") -> None:
    """Publish an SSE event via Redis pub/sub (production-ready, cross-process).

    ``sse_manager.publish()`` is synchronous – it writes directly to a Redis
    pub/sub channel.  The Redis SSE listener running inside the FastAPI process
    picks up the message and delivers it to local subscriber queues.
    No ``asyncio.run()`` wrapper needed.
    """
    try:
        sse_manager.publish(channel, data=data, event=event)
        logger.info(
            "SSE event published on channel='%s', event='%s'",
            channel, event,
        )
    except Exception as exc:
        logger.exception("Failed to publish SSE event: %s", exc)


@create_task(name="generate_design_base_image", max_retries=3)
def generate_design_base_image(self, design_id: int, prompt: str, channel: str):
    logger.info("Starting generate_design_base_image for design_id=%s", design_id)
    db = SessionLocal()

    try:
        design = db.query(Design).filter(Design.id == design_id).first()
        if not design:
            raise ValueError(f"Design with id {design_id} not found")

        # Resolve reference image URL
        reference_image_url = _resolve_reference_image_url(design) if (
            (design.input_image_urls and isinstance(design.input_image_urls, list) and design.input_image_urls)
            or design.input_image_url
        ) else None

        if reference_image_url:
            # ── V5 Cross-Agent Pipeline ──────────────────────────────
            # Build a progress callback that publishes SSE events at each stage
            def _progress_callback(stage: str, data: dict):
                sse_data = {
                    "design_id": design.id,
                    "design_code": design.design_code,
                    "stage": stage,
                    "message": data.get("message", ""),
                }
                _publish_sse(channel, data=sse_data, event=f"design.{stage}")

            # Run the cross-agent iterative refinement pipeline
            final_image_bytes, validations = generate_jewelry_with_cross_agent(
                base_image_source=reference_image_url,
                user_request=prompt,
                max_iterations=3,
                progress_callback=_progress_callback,
            )

            if final_image_bytes is None:
                raise ValueError("Cross-agent generation pipeline failed to produce a final image.")

            _validate_image_bytes(final_image_bytes, "image/png")

            # Upload final refined image to Supabase
            bucket_path = f"generated/base/{design.design_code}"
            generated_image_url = upload_image_to_supabase(final_image_bytes, bucket_path)

        else:
            # ── Fallback: prompt-only generation (no reference image) ─
            generated_item = openai_service.generate_image_from_prompt(prompt)
            image_bytes, content_type = _extract_generated_image_data(generated_item)
            _validate_image_bytes(image_bytes, content_type)

            bucket_path = f"generated/base/{design.design_code}"
            generated_image_url = upload_image_to_supabase(image_bytes, bucket_path)

        variant_service = DesignVariantService(db)
        variant = variant_service.create_initial_variant(
            design_id=design.id,
            base_design_image_url=generated_image_url,
            prompt_used=prompt,
            model_used=openai_service.model,
        )

        AIGenerationWorkflowService(db).complete_generation(
            design,
            variant.id,
            base_image_url=generated_image_url,
            prompt=prompt,
            model=openai_service.model,
        )

        _publish_sse(
            channel,
            data={
                "design_id": design.id,
                "design_code": design.design_code,
                "status": "GENERATED",
                "base_image_url": generated_image_url,
            },
            event="design.generated",
        )

        # Close the SSE stream – the client has received the final event.
        try:
            sse_manager.publish_close(channel)
        except Exception:
            logger.warning("Failed to publish SSE close signal for channel=%s", channel)

        logger.info("generate_design_base_image completed for design_id=%s", design_id)

    except Exception as exc:
        logger.exception("generate_design_base_image failed for design_id=%s: %s", design_id, exc)
        try:
            _publish_sse(
                channel,
                data={
                    "design_id": design_id,
                    "status": "FAILED",
                    "error": str(exc),
                },
                event="design.failed",
            )
            # Close the SSE stream on failure as well.
            sse_manager.publish_close(channel)
        except Exception:
            logger.warning("Failed to publish SSE failure event for design_id=%s", design_id)

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3,
        )

    finally:
        db.close()


@create_task(name="refine_design_variant_image", max_retries=3)
def refine_design_variant_image(
    self,
    design_id: int,
    variant_id: int,
    parent_variant_id: int,
    prompt: str,
    model_used: str,
    style_tags: str = None,
    design_focus: str = None,
    channel: str = None,
):
    """Generate a refined variant image via AI in the background.

    Takes the parent variant's image as reference, calls OpenAI to
    generate a refined image, uploads it, and updates the variant record.

    SSE events are published on the ``channel`` (e.g. ``variant:42``).
    """
    logger.info(
        "Starting refine_design_variant_image for variant_id=%s (design_id=%s)",
        variant_id, design_id,
    )
    db = SessionLocal()

    try:
        from app.models.design import DesignVariant
        from app.services.design_variant_service import DesignVariantService

        # Fetch parent variant to get the reference image
        parent_variant = db.query(DesignVariant).filter(DesignVariant.id == parent_variant_id).first()
        if not parent_variant or not parent_variant.base_design_image_url:
            raise ValueError(
                f"Parent variant {parent_variant_id} has no base_design_image_url"
            )

        reference_image_url = parent_variant.base_design_image_url

        # Build a combined prompt incorporating style_tags and design_focus
        combined_prompt = prompt or ""
        if style_tags:
            combined_prompt = f"{combined_prompt}\nStyle tags: {style_tags}"
        if design_focus:
            combined_prompt = f"{combined_prompt}\nFocus on: {design_focus}"

        # Generate refined image via OpenAI
        generated_item = openai_service.generate_base_image(reference_image_url, combined_prompt)
        image_bytes, content_type = _extract_generated_image_data(generated_item)
        _validate_image_bytes(image_bytes, content_type)

        # Upload to Supabase
        bucket_path = f"generated/refined/{design_id}/v{variant_id}"
        generated_image_url = upload_image_to_supabase(image_bytes, bucket_path)

        # Update the variant record with the generated image URL
        variant_service = DesignVariantService(db)
        variant = variant_service.get_variant(variant_id)
        if not variant:
            raise ValueError(f"Variant {variant_id} not found for image update")

        # Update the variant's base_design_image_url
        from app.repositories.design_variant import DesignVariantRepository
        variant_repo = DesignVariantRepository(db)
        variant_repo.update_variant(variant, base_design_image_url=generated_image_url)

        _publish_sse(
            channel,
            data={
                "design_id": design_id,
                "variant_id": variant.id,
                "parent_variant_id": parent_variant_id,
                "variant_name": variant.variant_name,
                "version_number": variant.version_number,
                "status": "REFINED",
                "base_image_url": generated_image_url,
                "prompt_used": prompt,
                "style_tags": style_tags,
                "design_focus": design_focus,
            },
            event="design.refined",
        )

        # Close the SSE stream
        try:
            sse_manager.publish_close(channel)
        except Exception:
            logger.warning("Failed to publish SSE close signal for channel=%s", channel)

        logger.info("refine_design_variant_image completed for variant_id=%s", variant_id)

    except Exception as exc:
        logger.exception(
            "refine_design_variant_image failed for variant_id=%s: %s", variant_id, exc
        )
        try:
            _publish_sse(
                channel,
                data={
                    "design_id": design_id,
                    "variant_id": variant_id,
                    "status": "FAILED",
                    "error": str(exc),
                },
                event="design.failed",
            )
            sse_manager.publish_close(channel)
        except Exception:
            logger.warning("Failed to publish SSE failure event for channel=%s", channel)

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3,
        )

    finally:
        db.close()
