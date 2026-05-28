"""
Cross-Agent Iterative Refinement Pipeline (v5)
======================================================================
Integrates with the existing OpenAIService singleton for all API calls,
and uses Supabase storage instead of local filesystem saving.

Pipeline (from openai_standalone_v5.py):
  Agent 1 → analyze_changes_with_vision()
  Agent 2 → generate_initial_image()
  Agent 3 → compare_and_validate()
  Agent 4 → refine_image()
"""

from __future__ import annotations

import base64
import io
import json
import logging
import uuid
from typing import Any

from PIL import Image

from app.services.openai_service import openai_service
from app.services.storage_service import upload_image_to_supabase

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VISION_MODEL = "gpt-4o"
EDIT_MODEL = "gpt-image-2"
DEFAULT_MAX_ITERATIONS = 3

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_image_bytes(source: str) -> bytes:
    """Load image bytes from URL or local path."""
    return openai_service._load_image_bytes_from_source(source)


def _encode_base64(image_bytes: bytes) -> str:
    return openai_service._encode_image_to_base64(image_bytes)


def _extract_openai_image(data_item: Any) -> bytes:
    """Extract image bytes from an OpenAI API response data item."""
    if hasattr(data_item, "b64_json") and data_item.b64_json:
        return base64.b64decode(data_item.b64_json)
    if isinstance(data_item, dict) and data_item.get("b64_json"):
        return base64.b64decode(data_item["b64_json"])
    # Fallback: download from URL
    url = getattr(data_item, "url", None) or (
        data_item.get("url") if isinstance(data_item, dict) else None
    )
    if url:
        import requests
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        return resp.content
    raise ValueError("OpenAI response did not contain image bytes or URL.")


def _generate_image_edit(
    image_bytes: bytes,
    prompt: str,
) -> bytes:
    """Call OpenAI image-edit API with raw image bytes and return resulting bytes."""
    # Convert bytes → PIL → RGBA → buffer (matching _load_image_buffer_from_source pattern)
    img = Image.open(io.BytesIO(image_bytes))
    img = img.convert("RGBA")
    img = img.resize((1024, 1024))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    file_tuple = ("image.png", buf, "image/png")

    result = openai_service.client.images.edit(
        model=EDIT_MODEL,
        image=file_tuple,
        prompt=prompt,
        n=1,
        size="1024x1024",
    )
    return _extract_openai_image(result.data[0])


# ---------------------------------------------------------------------------
# Agent Implementations
# ---------------------------------------------------------------------------

def analyze_changes_with_vision(
    base_image_source: str,
    user_request: str,
) -> dict:
    """
    Agent 1 – Analyze what changes need to be made using GPT-4o vision.

    This delegates to the ``OpenAIService.analyze_changes_with_vision()``
    method that was added in the same commit as this module.
    """
    logger.info("🔍 Agent 1: Analyzing requirements with vision...")
    analysis = openai_service.analyze_changes_with_vision(
        base_image_source, user_request,
    )
    logger.info("Changes needed: %s", analysis.get("changes_needed"))
    logger.info("Must preserve: %s", analysis.get("must_preserve"))
    return analysis


def generate_initial_image(
    base_image_source: str,
    analysis: dict,
) -> bytes | None:
    """
    Agent 2 – Generate initial image with changes applied.

    Returns raw image bytes, or ``None`` on failure.
    """
    logger.info("🎨 Agent 2: Generating initial image...")
    try:
        changes_text = ", ".join(analysis.get("changes_needed", []))
        preserve_text = ", ".join(analysis.get("must_preserve", []))

        prompt = f"""You are a master jewelry CAD designer. Create a HYPER-REALISTIC jewelry render.

BASE IMAGE: Reference for style and proportions
CHANGES TO IMPLEMENT: {changes_text}
MUST PRESERVE: {preserve_text}

CRITICAL REQUIREMENTS:
- Every curve mathematically perfect - no wavering
- All circles perfectly circular (no oval distortion)
- Perfect bilateral symmetry
- Metal shows micro-surface detail and bright specular highlights
- Stones show brilliance, fire, and scintillation
- All elements properly attached (no floating parts)

LOGICAL ELEMENT ATTACHMENT:
- If text requested: engraved with proper depth (0.3-0.5mm) or raised as part of metal
- If spinning bands: show bearing mechanism and rotation gap
- If stacked bands: separate but cohesive with 0.1-0.2mm gap
- All attached elements show proper connection points

LIGHTING: Professional 5-point studio lighting
BACKGROUND: Pure white
OUTPUT: Ultra-realistic CAD render, Cartier/Tiffany quality"""

        base_bytes = _load_image_bytes(base_image_source)
        image_bytes = _generate_image_edit(base_bytes, prompt)
        logger.info("Initial image generated successfully")
        return image_bytes

    except Exception as e:
        logger.error("Initial generation failed: %s", e)
        return None


def compare_and_validate(
    base_image_source: str,
    generated_image_bytes: bytes,
    analysis: dict,
) -> dict:
    """
    Agent 3 – Compare generated image with requirements and identify issues.

    Saves generated bytes to a temporary location for vision comparison,
    then delegates to ``OpenAIService.compare_and_validate()``.
    """
    logger.info("🔍 Agent 3: Comparing and validating...")
    try:
        # Upload generated bytes temporarily so we can pass a URL to the
        # vision comparison (the service method expects a URL or file path).
        # Use a temp-like bucket path that can be cleaned up later.
        temp_path = f"_v5_temp/validate_{uuid.uuid4().hex}.png"
        generated_url = upload_image_to_supabase(generated_image_bytes, temp_path)

        validation = openai_service.compare_and_validate(
            base_image_source,
            generated_url,
            analysis,
        )

        logger.info("Changes implemented: %s", len(validation.get("changes_implemented", [])))
        logger.info("Missing changes: %s", len(validation.get("missing_changes", [])))
        logger.info("Quality issues: %s", len(validation.get("quality_issues", [])))
        return validation

    except Exception as e:
        logger.warning("Comparison failed: %s", e)
        return {
            "changes_implemented": [],
            "missing_changes": ["unknown"],
            "quality_issues": ["comparison_failed"],
            "needs_refinement": True,
            "refinement_notes": "Unable to compare, need to regenerate",
        }


def refine_image(
    generated_image_bytes: bytes,
    validation: dict,
    analysis: dict,
) -> bytes | None:
    """
    Agent 4 – Refine the image based on validation feedback.

    Returns refined image bytes, or ``None`` on failure.
    """
    logger.info("🔧 Agent 4: Refining image...")
    try:
        missing_changes = ", ".join(validation.get("missing_changes", []))
        quality_issues = ", ".join(validation.get("quality_issues", []))
        refinement_notes = validation.get("refinement_notes", "")

        prompt = f"""You are refining a jewelry CAD render to fix issues.

CURRENT IMAGE: The image to be refined
ISSUES TO FIX: {missing_changes}
QUALITY PROBLEMS: {quality_issues}
SPECIFIC NOTES: {refinement_notes}

CRITICAL FIXES NEEDED:
- Ensure all requested changes are implemented
- Fix any floating or improperly attached elements
- Complete any incomplete bands or circles
- Ensure perfect symmetry and geometry
- Fix text/numerals if present (spell exactly, proper depth)
- Fix spinning band mechanisms if present
- Ensure stacked bands have proper gaps

RENDERING STANDARDS:
- Mathematically perfect curves
- Bright specular highlights on metal
- Stone brilliance and fire
- Professional studio lighting
- Pure white background

Generate the perfected version addressing all issues."""

        refined_bytes = _generate_image_edit(generated_image_bytes, prompt)
        logger.info("Refined image generated successfully")
        return refined_bytes

    except Exception as e:
        logger.error("Refinement failed: %s", e)
        return None


# ---------------------------------------------------------------------------
# Main pipeline (orchestrator)
# ---------------------------------------------------------------------------

def generate_jewelry_with_cross_agent(
    base_image_source: str,
    user_request: str,
    *,
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
    progress_callback: callable = None,
) -> tuple[list[bytes] | None, list[dict]]:
    """
    Cross-agent iterative refinement pipeline (v5).

    Parameters
    ----------
    base_image_source : str
        URL or local path to the reference base image.
    user_request : str
        User's design modification request.
    max_iterations : int
        Maximum number of refine-validate loops (default 3).
    progress_callback : callable, optional
        Called with ``(stage: str, data: dict)`` for each pipeline step.
        ``stage`` is one of:
        ``"analyzing"``, ``"generating"``, ``"validating"``,
        ``"refining"``, ``"complete"``, ``"failed"``.

    Returns
    -------
    tuple[list[bytes] | None, list[dict]]
        ``(all_image_bytes, all_validation_results)``
        On failure the first element will be ``None``.
    """
    logger.info("Starting cross-agent jewelry generation")
    logger.info("Request: %s", user_request)

    all_images: list[bytes] = []
    all_validations: list[dict] = []

    def _progress(stage: str, msg: str = "", **extra):
        if progress_callback:
            progress_callback(stage, {"message": msg, **extra})

    # -----------------------------------------------------------------------
    # Agent 1 – Analyze
    # -----------------------------------------------------------------------
    _progress("analyzing", "Analyzing reference image with vision...")
    analysis = analyze_changes_with_vision(base_image_source, user_request)

    # -----------------------------------------------------------------------
    # Agent 2 – Generate initial image
    # -----------------------------------------------------------------------
    _progress("generating", "Generating initial design...")
    current_image = generate_initial_image(base_image_source, analysis)
    if current_image is None:
        _progress("failed", "Initial generation failed")
        return None, all_validations

    all_images.append(current_image)

    # -----------------------------------------------------------------------
    # Iterative refinement loop
    # -----------------------------------------------------------------------
    for iteration in range(max_iterations):
        logger.info("🔄 Iteration %d/%d", iteration + 1, max_iterations)

        # Agent 3 – Validate
        _progress(
            "validating",
            f"Validating generated image (iteration {iteration + 1})...",
            iteration=iteration,
        )
        validation = compare_and_validate(
            base_image_source, current_image, analysis,
        )
        all_validations.append(validation)

        if not validation.get("needs_refinement", True):
            logger.info("✅ Image meets all requirements!")
            _progress("complete", "All requirements met!", iteration=iteration)
            break

        if iteration < max_iterations - 1:
            # Agent 4 – Refine
            _progress(
                "refining",
                f"Refining image (iteration {iteration + 1})...",
                iteration=iteration,
            )
            refined = refine_image(current_image, validation, analysis)
            if refined:
                current_image = refined
                all_images.append(current_image)
            else:
                logger.warning("Refinement failed, continuing with current image")
                break

    _progress(
        "complete",
        f"Generation complete — {len(all_images)} images generated",
        total_images=len(all_images),
    )
    logger.info("🎉 Cross-agent generation complete!")
    logger.info("Generated %d images in the process", len(all_images))

    return current_image, all_validations


# ---------------------------------------------------------------------------
# Convenience: upload final result to Supabase
# ---------------------------------------------------------------------------

def upload_final_image(
    image_bytes: bytes,
    design_id: int | str,
    variant_id: int | str | None = None,
) -> str:
    """
    Upload the final generated image to Supabase and return the URL.

    Parameters
    ----------
    image_bytes : bytes
        Raw PNG image bytes.
    design_id : int | str
        Design identifier used for bucket path.
    variant_id : int | str | None
        Optional variant identifier.

    Returns
    -------
    str — Supabase URL of the uploaded image.
    """
    suffix = f"v{variant_id}" if variant_id else "initial"
    bucket_path = f"generated/base/{design_id}/{suffix}"
    return upload_image_to_supabase(image_bytes, bucket_path)