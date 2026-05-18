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

        reference_image_url = _resolve_reference_image_url(design)
        generated_item = openai_service.generate_base_image(reference_image_url, prompt)
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
        except Exception:
            logger.warning("Failed to publish SSE failure event for design_id=%s", design_id)

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3,
        )

    finally:
        db.close()
