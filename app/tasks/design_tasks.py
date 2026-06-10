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

        # Resolve reference image source (can be a list of URLs or single URL)
        reference_image_source = None
        if design.input_image_urls and isinstance(design.input_image_urls, list) and design.input_image_urls:
            reference_image_source = design.input_image_urls
        elif design.input_image_url:
            reference_image_source = design.input_image_url

        detected_metal = None
        metal_variations_json = None
        if reference_image_source:
            # Detect metal tone from reference image first to pass to generator
            primary_ref = reference_image_source[0] if isinstance(reference_image_source, list) else reference_image_source
            try:
                from app.repositories.design_variant import detect_metal_tone
                metal_dict = detect_metal_tone(prompt, primary_ref)
                if metal_dict:
                    detected_key = list(metal_dict.keys())[0]
                    if detected_key == "gold":
                        detected_metal = "yellow_gold"
                    elif detected_key == "silver":
                        detected_metal = "white_gold"
                    else:
                        detected_metal = detected_key
            except Exception as e:
                logger.warning(f"Failed to pre-detect metal tone in task: {e}")

            # Publish initial stage events
            _publish_sse(
                channel,
                data={
                    "design_id": design.id,
                    "design_code": design.design_code,
                    "stage": "generating",
                    "message": "Generating jewelry render with OpenAI...",
                },
                event="design.generating",
            )

            # Use the newly migrated Gemini high-fidelity pipeline (Primary + Fallback + QA Checks)
            generated_item = openai_service.generate_base_image(
                image_source=reference_image_source,
                user_prompt=prompt,
                jewellery_type=design.jewellery_type or "pendant",
                metal_tone=detected_metal
            )

            final_image_bytes, content_type = _extract_generated_image_data(generated_item)
            _validate_image_bytes(final_image_bytes, content_type)

            # Upload final refined image to Supabase
            bucket_path = f"generated/base/{design.design_code}"
            generated_image_url = upload_image_to_supabase(final_image_bytes, bucket_path)

            if detected_metal:
                db_key = "gold" if detected_metal == "yellow_gold" else ("silver" if detected_metal == "white_gold" else detected_metal)
                metal_variations_json = {db_key: generated_image_url}

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
            metal_variations_json=metal_variations_json,
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
    reference_images: list = None,
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

        # Resolve reference images for AI generation
        parent_variant = db.query(DesignVariant).filter(DesignVariant.id == parent_variant_id).first()
        parent_variant_img = parent_variant.base_design_image_url if parent_variant else None

        if reference_images:
            # Ensure the parent variant's image is always the first (primary) image in the reference list,
            # acting as the master visual truth.
            if parent_variant_img:
                if parent_variant_img in reference_images:
                    # Remove it and put it at the front
                    imgs = [img for img in reference_images if img != parent_variant_img]
                    reference_image_source = [parent_variant_img] + imgs
                else:
                    # Prepend it to the user uploaded references
                    reference_image_source = [parent_variant_img] + reference_images
            else:
                reference_image_source = reference_images
        else:
            if not parent_variant_img:
                raise ValueError(
                    f"Parent variant {parent_variant_id} has no base_design_image_url"
                )
            reference_image_source = [parent_variant_img]


        # Look up jewellery_type from the design
        from app.models.design import Design as DesignModel
        design = db.query(DesignModel).filter(DesignModel.id == design_id).first()
        jewellery_type = design.jewellery_type if design else ""

        # Build a combined prompt incorporating style_tags and design_focus
        combined_prompt = prompt or ""
        if style_tags:
            combined_prompt = f"{combined_prompt}\nStyle tags: {style_tags}"
        if design_focus:
            combined_prompt = f"{combined_prompt}\nFocus on: {design_focus}"

        # Resolve metal tone from the parent variant's database record
        parent_metal = None
        if parent_variant:
            if parent_variant.metal_variations_json:
                # Find the key whose value matches the parent's base_design_image_url
                for m, url in parent_variant.metal_variations_json.items():
                    if url == parent_variant.base_design_image_url:
                        parent_metal = m
                        break
                if not parent_metal:
                    # Fallback: get the first key
                    parent_metal = list(parent_variant.metal_variations_json.keys())[0]

        # Generate refined image via OpenAI using the resolved reference images
        generated_item = openai_service.generate_base_image(
            reference_image_source,
            combined_prompt,
            jewellery_type=jewellery_type,
            metal_tone=parent_metal
        )
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
