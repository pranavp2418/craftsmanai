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
from app.services.webpush_service import WebPushService

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

            # SIMPLIFIED (basics-first): a first CREATE just sends the user's prompt + the image straight
            # to the model. NO per-image classify, NO parse_request, NO metal-detection — those 3 LLM
            # calls slowed every request and mis-routed it (a create became a 'refine', wrong type, the
            # metal got second-guessed). Metal is read ONLY from the prompt text (cheap regex). If the
            # user gave NO prompt at all, read the written brief (and any font) out of the image so there
            # is something to generate from.
            from app.services.openai_service import extract_image_instructions, extract_metal_from_prompt, detect_metal_color
            _prompt_metal = extract_metal_from_prompt(prompt)
            input_metal = _prompt_metal or "yellow_gold"
            _metal_named = _prompt_metal is not None
            _internal = ""
            # READ THE IN-IMAGE BRIEF when the client uploaded a design / spec-sheet and gave NO real design
            # instruction — i.e. an EMPTY prompt OR a generic "make / same this" (they want the IMAGE built,
            # not a specific change). This recovers the written brief (metal / size / name) the way Lovable's
            # parse does, so e.g. a "Liv + heart" name design with a "10KT White Gold" note builds in white
            # gold instead of being reproduced as the flat reference.
            _lp = (prompt or "").strip().lower()
            _generic_build = (not _lp) or (
                len(_lp.split()) <= 6
                and any(w in _lp for w in ("same", "this", "that", " it", "make this", "build"))
                and not any(w in _lp for w in ("add", "remove", "change", "without", "instead",
                                               "make it ", "turn it", "convert it"))
            )
            if _generic_build:
                try:
                    _refs = reference_image_source if isinstance(reference_image_source, list) else [reference_image_source]
                    _u = next((u for u in _refs if u), None)
                    if _u:
                        _b64 = base64.b64encode(requests.get(_u, timeout=20).content).decode("utf-8")
                        _brief, _font_style = extract_image_instructions(_b64)
                        if _brief:
                            prompt = _brief
                            # pick up a metal named in the brief ("10KT White Gold") so we don't default to yellow
                            _brief_metal = extract_metal_from_prompt(_brief)
                            if _brief_metal:
                                input_metal = _brief_metal
                                _metal_named = True
                            logger.info("Read in-image brief for design_id=%s: %s", design_id, _brief[:200])
                            try:
                                design.user_prompt = _brief
                                db.commit()
                            except Exception:
                                db.rollback()
                        if _font_style:
                            _internal += (
                                f"\n\nFONT: render ALL lettering in this EXACT font style: {_font_style}. "
                                "Keep the design, colours and everything else the same."
                            )
                except Exception as _be:
                    logger.warning("in-image brief read failed for design_id=%s: %s", design_id, _be)

            # No metal named anywhere (prompt or brief) but there IS a reference image -> DETECT the image's
            # actual metal colour. Otherwise a silver / white-gold piece sent as "same to same" defaults to
            # yellow gold, and the angle views then RECOLOUR it to gold (the "silver -> gold" bug). The
            # reference's own colour must win when the user didn't name a metal.
            if not _metal_named and reference_image_source:
                try:
                    _refs2 = reference_image_source if isinstance(reference_image_source, list) else [reference_image_source]
                    _u2 = next((u for u in _refs2 if u), None)
                    if _u2:
                        _mb64 = base64.b64encode(requests.get(_u2, timeout=20).content).decode("utf-8")
                        _dm = detect_metal_color(_mb64)
                        if _dm:
                            input_metal = _dm
                            logger.info("Detected base-image metal=%s for design_id=%s (no metal named)", _dm, design_id)
                except Exception as _me:
                    logger.warning("base-image metal detect failed for design_id=%s: %s", design_id, _me)

            gen_prompt = (prompt or "") + _internal

            # CREATE = ALWAYS initial; no parsed_data (item_type comes straight from jewellery_type).
            generated_item = openai_service.generate_base_image(
                image_source=reference_image_source,
                user_prompt=gen_prompt,
                jewellery_type=design.jewellery_type or "",
                metal_tone=input_metal,
                mode="initial",
                parsed_data=None,
            )

            # Retrieve the dynamically detected metal tone from the vision translator
            detected_metal = getattr(generated_item, "detected_metal", None) or "yellow_gold"

            final_image_bytes, content_type = _extract_generated_image_data(generated_item)
            _validate_image_bytes(final_image_bytes, content_type)

            # Upload final refined image to Supabase
            bucket_path = f"generated/base/{design.design_code}"
            generated_image_url = upload_image_to_supabase(final_image_bytes, bucket_path)

            # Register the base image under its ACTUAL metal so the UI shows the correct base colour AND the
            # angle views REUSE this image for that metal (recolor=False) instead of recolouring the base to a
            # frontend-sent default metal (the "silver base -> gold angle views" bug). metal_variations_json
            # is otherwise None (the pixel auto-seeder is disabled), so EVERY angle request recoloured.
            if generated_image_url and input_metal:
                metal_variations_json = {input_metal: generated_image_url}

        else:
            # ── Fallback: prompt-only generation (no reference image) ─
            generated_item = openai_service.generate_image_from_prompt(
                prompt, jewellery_type=(design.jewellery_type or "")
            )
            final_image_bytes, content_type = _extract_generated_image_data(generated_item)
            _validate_image_bytes(final_image_bytes, content_type)

            bucket_path = f"generated/base/{design.design_code}"
            generated_image_url = upload_image_to_supabase(final_image_bytes, bucket_path)

            # Prompt-only: register the base image under the prompt's metal (or yellow-gold default) so the
            # angle views reuse it for that metal instead of recolouring.
            from app.services.openai_service import extract_metal_from_prompt as _emfp
            _tm = _emfp(prompt) or "yellow_gold"
            if generated_image_url:
                metal_variations_json = {_tm: generated_image_url}

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

        # Send WebPush notification if user has push_notifications enabled
        try:
            _design = db.query(Design).filter(Design.id == design_id).first()
            if _design:
                WebPushService.send_design_failed_push(
                    db=db,
                    user_id=_design.user_id,
                    design_id=design_id,
                    design_code=getattr(_design, 'design_code', None),
                    error_message=str(exc),
                )
        except Exception as _push_err:
            logger.warning("Failed to send push notification for design_id=%s: %s", design_id, _push_err)

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
            # Trust the order the endpoint resolved: the FIRST image is the intended primary
            # reference (selected metal variant > explicit URL > parent base), followed by any
            # user-uploaded reference images. Do NOT forcibly re-prepend the parent base — that
            # overrode a user's selected metal variant with the base metal.
            reference_image_source = list(reference_images)
        elif parent_variant_img:
            reference_image_source = [parent_variant_img]
        else:
            raise ValueError(
                f"Parent variant {parent_variant_id} has no base_design_image_url"
            )


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

        # ROUTE REFINES THROUGH THE CREATE-WITH-IMAGE PATH (mode="initial").
        # WHY: the dedicated refine/edit path (MASTER_REFINE, preserve-first) made the model NO-OP — it kept
        # the base render and DROPPED the requested change (validated across "make it fully iced" and a
        # bail-swap). The create-with-image path instead REPRODUCES the base faithfully AND applies the
        # requested change — which is exactly what a refine should be: keep the OLD piece identical, change
        # ONLY what's asked. (Validated: bail-swap preserved the heart and swapped in the new bail; metal
        # recolour and element edits apply.) We frame the change as a "reproduce + change only this" request
        # so the first image is the source of truth and everything unmentioned stays identical.
        _refine_change = (combined_prompt or "").strip()
        # IMPORTANT: do NOT enumerate components to preserve (e.g. "keep the bail...") — if the change IS that
        # component (a bail swap), listing it contradicts the edit and the model keeps the original. Just say
        # "apply ONLY this change, keep EVERYTHING ELSE identical" and let the model infer what "else" is.
        _create_prompt = (
            "Reproduce the FIRST piece EXACTLY as it is and apply ONLY the following change — keep EVERYTHING "
            f"ELSE about the piece identical (do not redesign anything that is not part of this change): {_refine_change}"
            if _refine_change else combined_prompt
        )
        generated_item = openai_service.generate_base_image(
            reference_image_source, _create_prompt, jewellery_type=jewellery_type, mode="initial"
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

        # Resolve the refined image's metal for the UI swatch. Trust the actual output detection;
        # but if it fails/returns nothing, do NOT blindly default to "gold" (that mislabeled white /
        # rose pieces). Fall back to: the user's requested metal -> the SOURCE image's metal (a refine
        # keeps the source metal unless changed) -> "gold" as the absolute last resort.
        import base64 as _b64
        from app.services.openai_service import detect_metal_color, extract_metal_from_prompt
        try:
            detected = detect_metal_color(_b64.b64encode(image_bytes).decode("utf-8"))
        except Exception as _rm_err:
            logger.warning("Refine metal detection failed for variant=%s: %s", variant_id, _rm_err)
            detected = None
        refined_metal = (detected or "").strip().lower() or None
        if not refined_metal:
            refined_metal = extract_metal_from_prompt(prompt)
        if not refined_metal and reference_image_source:
            try:
                from app.services.openai_service import download_reference_images
                _src = reference_image_source[0] if isinstance(reference_image_source, list) else reference_image_source
                _src_blobs = download_reference_images([_src])
                if _src_blobs:
                    _src_metal = detect_metal_color(_b64.b64encode(_src_blobs[0]).decode("utf-8"))
                    refined_metal = (_src_metal or "").strip().lower() or None
            except Exception as _se:
                logger.warning("Source-metal fallback failed for variant=%s: %s", variant_id, _se)
        refined_metal = refined_metal or "gold"
        logger.info("Refined image metal resolved as '%s' for variant_id=%s", refined_metal, variant_id)

        # Update the variant: new base image + detected metal + clean metal map (only base).
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
            logger.warning("Failed to publish SSE failure event for design_id=%s", design_id)

        # Send WebPush notification if user has push_notifications enabled
        try:
            _design = db.query(Design).filter(Design.id == design_id).first()
            if _design:
                WebPushService.send_design_failed_push(
                    db=db,
                    user_id=_design.user_id,
                    design_id=design_id,
                    design_code=getattr(_design, 'design_code', None),
                    error_message=str(exc),
                )
        except Exception as _push_err:
            logger.warning("Failed to send push notification for design_id=%s: %s", design_id, _push_err)

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3,
        )

    finally:
        db.close()
