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

        if reference_image_source:
            # Publish initial stage events
            _publish_sse(
                channel,
                data={
                    "design_id": design.id,
                    "design_code": design.design_code,
                    "stage": "generating",
                    "message": "Generating jewelry render with Gemini...",
                },
                event="design.generating",
            )

            # Inspect the reference image(s) for: (a) the in-image brief / font, and
            # (b) jewelry-vs-not classification per image, which drives the metal and whether
            # this is a memorial photo pendant (person photo + a jewelry reference) or a
            # non-jewelry logo (-> pure gold).
            input_metal = "yellow_gold"
            # Internal, generation-ONLY instructions (font / gold / memorial). These are
            # appended to the prompt sent to the model but NOT to the user-facing prompt that
            # gets saved + shown in the UI ("Design Prompt").
            _internal = ""
            try:
                from app.services.openai_service import (
                    extract_image_instructions, classify_reference_image,
                    NON_JEWELRY_GOLD_INSTRUCTION, MEMORIAL_PHOTO_PENDANT_INSTRUCTION,
                )
                _refs = reference_image_source if isinstance(reference_image_source, list) else [reference_image_source]
                _refs = [u for u in _refs if u][:4]

                # Download + classify EACH reference (jewelry vs logo/graphic/person photo).
                _first_b64 = None
                _classified = []
                for _u in _refs:
                    try:
                        _raw = requests.get(_u, timeout=20).content
                        _b = base64.b64encode(_raw).decode("utf-8")
                        if _first_b64 is None:
                            _first_b64 = _b
                        _classified.append(classify_reference_image(_b))
                    except Exception as _ce:
                        logger.warning("Reference classify/fetch failed (%s): %s", str(_u)[:60], _ce)
                        _classified.append({"is_jewelry": True, "metal": "gold"})

                # (a) Read the written brief + any requested font only if the text box is empty.
                if not (prompt or "").strip() and _first_b64:
                    _brief, _font_style = extract_image_instructions(_first_b64)
                    if _brief:
                        prompt = _brief
                        logger.info("Extracted in-image brief for design_id=%s: %s", design_id, _brief[:250])
                        try:
                            design.user_prompt = _brief
                            db.commit()
                        except Exception:
                            db.rollback()
                    if _font_style:
                        _internal += (
                            f"\n\nFONT — CHANGE IT: render ALL the lettering in this EXACT font style: {_font_style}. "
                            "This is a NEW font the customer requires — do NOT keep the reference's font; the "
                            "lettering STYLE is the one thing that must change. Keep the design, colours, enamel, "
                            "layers and everything else exactly the same."
                        )
                        logger.info("Applied requested font style for design_id=%s: %s", design_id, _font_style[:160])

                # (b) Metal + jewelry/non-jewelry handling across ALL references.
                _jewelry = [c for c in _classified if c.get("is_jewelry", True)]
                _nonjewelry = [c for c in _classified if not c.get("is_jewelry", True)]
                if _jewelry:
                    # At least one real JEWELRY reference → match its metal, keep its stones.
                    _m = _jewelry[0].get("metal")
                    if _m in ("gold", "silver", "rose_gold"):
                        input_metal = _m
                    if _nonjewelry and len(_refs) > 1:
                        # PERSON photo + JEWELRY reference → memorial photo pendant: copy the
                        # reference pendant's design and embed the person's portrait inside it.
                        _internal += MEMORIAL_PHOTO_PENDANT_INSTRUCTION
                        logger.info("Memorial photo pendant (embed photo into jewelry design) for design_id=%s", design_id)
                    logger.info("Reference has jewelry (metal='%s') for design_id=%s", input_metal, design_id)
                elif len(_refs) == 1:
                    # Single NON-jewelry image (logo/graphic) → pure SOLID GOLD pendant, no diamonds.
                    input_metal = "gold"
                    _internal += NON_JEWELRY_GOLD_INSTRUCTION
                    logger.info("Single non-jewelry input → pure gold pendant for design_id=%s", design_id)
                # else: multiple non-jewelry images → leave defaults (rare, ambiguous).
            except Exception as _pre_err:
                logger.warning("Pre-generation image read failed for design_id=%s: %s", design_id, _pre_err)

            # Generation prompt = the user-facing prompt + internal generation-only instructions.
            # The user-facing `prompt` itself is saved/displayed; `gen_prompt` goes to the model.
            gen_prompt = (prompt or "") + _internal

            # Use the newly migrated Gemini high-fidelity pipeline (Primary + Fallback + QA Checks)
            generated_item = openai_service.generate_base_image(
                image_source=reference_image_source,
                user_prompt=gen_prompt,
                jewellery_type=design.jewellery_type or "pendant",
                metal_tone=input_metal,
            )

            final_image_bytes, content_type = _extract_generated_image_data(generated_item)
            _validate_image_bytes(final_image_bytes, content_type)

            # Upload final refined image to Supabase
            bucket_path = f"generated/base/{design.design_code}"
            generated_image_url = upload_image_to_supabase(final_image_bytes, bucket_path)

        else:
            # ── Fallback: prompt-only generation (no reference image) ─
            generated_item = openai_service.generate_image_from_prompt(prompt)
            final_image_bytes, content_type = _extract_generated_image_data(generated_item)
            _validate_image_bytes(final_image_bytes, content_type)

            bucket_path = f"generated/base/{design.design_code}"
            generated_image_url = upload_image_to_supabase(final_image_bytes, bucket_path)

        # Detect the base image's metal color so the UI can default-select the matching
        # swatch and skip regenerating that color. Register the base under that metal.
        try:
            import base64 as _b64
            from app.services.openai_service import detect_metal_color
            base_metal = detect_metal_color(_b64.b64encode(final_image_bytes).decode("utf-8"))
        except Exception as _bm_err:
            logger.warning("Base metal detection failed for design_id=%s: %s", design_id, _bm_err)
            base_metal = "gold"
        logger.info("Base image metal detected as '%s' for design_id=%s", base_metal, design_id)

        variant_service = DesignVariantService(db)
        variant = variant_service.create_initial_variant(
            design_id=design.id,
            base_design_image_url=generated_image_url,
            prompt_used=prompt,
            model_used=openai_service.model,
            # Seed ONLY the detected base metal so the other metal swatches are "missing" and
            # regenerate on click. Passing this also skips the repo's auto-detect seeding.
            metal_variations_json={base_metal: generated_image_url},
        )

        # Persist the detected base metal and register the base image under that metal.
        # IMPORTANT: overwrite metal_variations_json with ONLY the detected base metal.
        # create_initial_variant runs an older pixel-based detector that can register the
        # base image under a WRONG metal (e.g. rose_gold), which would make the UI think
        # that color already exists and skip generating it. Our vision detection wins.
        try:
            from app.repositories.design_variant import DesignVariantRepository
            _variant_repo = DesignVariantRepository(db)
            _variant_repo.update_variant(
                variant,
                base_metal=base_metal,
                metal_variations_json={base_metal: generated_image_url},
            )
        except Exception as _upd_err:
            logger.warning("Failed to persist base_metal for variant=%s: %s", getattr(variant, "id", None), _upd_err)

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

        # Build the refine prompt. The USER PROMPT is the only edit instruction — do exactly
        # what it says and nothing else. style_tags / design_focus are OPTIONAL *visual style*
        # direction (how the jewellery should look/feel); they are NOT text and must never be
        # written or engraved onto the piece. Keep them on a clearly separated block with an
        # explicit no-engraving rule so they shape the aesthetic instead of leaking into the
        # text/engraving (which previously caused tag words to be carved into the piece).
        combined_prompt = (prompt or "").strip()
        style_bits = []
        if style_tags:
            style_bits.append(str(style_tags).strip())
        if design_focus:
            style_bits.append(f"emphasis on {str(design_focus).strip()}")
        if style_bits:
            combined_prompt = (
                f"{combined_prompt}\n\n"
                "STYLE DIRECTION (visual aesthetic only — describes HOW the piece should look and "
                "feel; do NOT write, letter, engrave, or add ANY of these words as text/characters "
                f"anywhere on the jewellery): {', '.join(style_bits)}. "
                "Apply this as overall styling while keeping the same overall design and only the "
                "user-requested change."
            ).strip()

        # Generate refined image via OpenAI using the resolved reference images
        generated_item = openai_service.generate_base_image(reference_image_source, combined_prompt, jewellery_type=jewellery_type)
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

        # Detect the refined image's metal color (vision) so the UI default-selects the
        # right swatch and registers the base under ONLY that metal (others regenerate).
        try:
            import base64 as _b64
            from app.services.openai_service import detect_metal_color
            refined_metal = detect_metal_color(_b64.b64encode(image_bytes).decode("utf-8"))
        except Exception as _rm_err:
            logger.warning("Refine metal detection failed for variant=%s: %s", variant_id, _rm_err)
            refined_metal = "gold"
        logger.info("Refined image metal detected as '%s' for variant_id=%s", refined_metal, variant_id)

        # Update the variant: new base image + detected metal + clean metal map (only base).
        from app.repositories.design_variant import DesignVariantRepository
        variant_repo = DesignVariantRepository(db)
        variant_repo.update_variant(
            variant,
            base_design_image_url=generated_image_url,
            base_metal=refined_metal,
            metal_variations_json={refined_metal: generated_image_url},
        )

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
