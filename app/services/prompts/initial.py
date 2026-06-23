"""Initial-generation prompt assembler (config-registry driven).

`build_initial_prompt(...)` has the SAME signature as the old
`openai_service._build_concise_initial_prompt`, so it is a drop-in replacement.

Structure (the "common system prompt + user prompt" model the client asked for):
  * COMMON_SYSTEM_PROMPT  -> the shared, adjustable "system" layer (one place to tune).
  * a short type/form line -> only what the jewellery type structurally needs (e.g. pendant bail).
  * USER REQUEST           -> the client's OWN prompt, verbatim and DOMINANT — it drives the render.
  * opt-in modules         -> attached only for text-only renders, gated by the type's profile.

Behaviours / fixes:
  * IMAGE inputs stay SHORT (proven gpt-image-2 insight). Preservation + "diamonds stay
    diamonds" now live in COMMON_SYSTEM_PROMPT, so the per-image text is lean and the user's
    request is front-and-centre.
  * Pendant bail is ONE coherent instruction (no "identical vs add bail" contradiction).
  * METAL: no default "light yellow gold" note is forced onto image inputs (it only applies
    when yellow gold is actually the effective metal) — this stops white/rose pieces drifting.
  * Capability rule-blocks attach ONLY when the type's profile allows AND they are detected.

All rule TEXT and detection helpers are read lazily from openai_service (single source of
truth); this module imports nothing from it at import time (no circular imports).
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from .profiles import (
    resolve_profile,
    MODULE_TEXT, MODULE_STONE, MODULE_SKETCH,
    BAIL_ADD_IF_MISSING, BAIL_PRESERVE,
    TEXT_PRIMARY, TEXT_IF_DETECTED,
)
from .common import COMMON_SYSTEM_PROMPT, light_gold_note, diamond_cut_clause, metal_conversion_clause


_USER_METAL_WORDS = ["white gold", "rose gold", "yellow gold", "platinum", "silver", "10k", "14k", "18k"]
_SKETCH_WORDS = ["sketch", "drawing", "draw", "hand drawn", "hand-drawn", "pencil", "doodle"]
_TEXT_WORDS = ["name", "initial", "letter", "number", "word", "text", "monogram", "spell", "says", "reads", "font"]


def _has_text_intent(user_prompt: str) -> bool:
    p = (user_prompt or "").lower()
    return bool(re.search(r"[0-9]", user_prompt or "")) or any(w in p for w in _TEXT_WORDS)


def build_initial_prompt(
    user_prompt: str,
    parsed_data: Optional[Dict[str, Any]],
    metal_tone: str,
    has_images: bool,
    image_count: int = 0,
) -> str:
    """Build the initial-generation prompt. Drop-in for _build_concise_initial_prompt."""
    # Lazy import — guarantees no circular import and a single source of truth for rule text.
    from app.services import openai_service as svc

    item_type = (parsed_data or {}).get("item_type") or svc.infer_item_type_from_prompt(user_prompt) or "jewelry"
    profile = resolve_profile(item_type)
    lower = (user_prompt or "").lower()
    user_named_metal = any(m in lower for m in _USER_METAL_WORDS)

    if has_images:
        return _assemble_image(svc, user_prompt, lower, item_type, profile, image_count, user_named_metal)
    return _assemble_text_only(svc, user_prompt, lower, item_type, profile, metal_tone, user_named_metal)


# ---------------------------------------------------------------------------
# IMAGE-INPUT branch — kept intentionally SHORT; user request is dominant.
# ---------------------------------------------------------------------------
def _assemble_image(svc, user_prompt, lower, item_type, profile, image_count, user_named_metal) -> str:
    keep_ref_angle = not svc._user_wants_front(user_prompt)
    angle_phrase = (
        "keeping the SAME camera angle as the reference image" if keep_ref_angle
        else "in a straight FRONT-FACING view"
    )

    is_pendant = profile.bail_policy in (BAIL_ADD_IF_MISSING, BAIL_PRESERVE) and svc._is_pendant_like(item_type, user_prompt)

    if is_pendant:
        # Bail is carved out of "preserve" right here, in ONE coherent instruction.
        form_line = (
            f"Render this reference as a wearable PENDANT, {angle_phrase}. The pendant must hang from EXACTLY ONE "
            "bail/hook at the very top-centre. IMPORTANT: if the reference ALREADY has a bail, hook, loop, or any "
            "top hanging element, KEEP that one as-is and do NOT add another — there must never be two bails or a "
            "bail stacked on top of an existing one. ONLY if the reference has NO bail at all (e.g. a flat sketch) "
            "add a single FLARED, FAN-SHAPED bail (wider at the top, tapering to a small loop) at the top-centre. "
            "If a chain or cord is shown, remove it and show only the pendant with its single bail."
        )
    else:
        form_line = f"Render this reference as a {item_type}, {angle_phrase}.{svc._type_form_clause(item_type, user_prompt)}"

    # USER REQUEST — the client's own prompt, dominant and verbatim.
    if svc._is_metal_only_change(user_prompt):
        mp = svc._detected_metal_phrase(user_prompt) or "the requested metal"
        user_request = (
            f"USER REQUEST: change ONLY the metal colour to {mp}. Keep the design and EVERY stone identical to the "
            "reference image."
        )
    elif user_prompt:
        user_request = f"USER REQUEST (apply exactly as written, change nothing else): {user_prompt}"
    else:
        user_request = "USER REQUEST: faithfully reproduce the reference piece exactly as it appears."

    # METAL FIX: only force the light-gold note when the user actually asked for (yellow) gold.
    if "yellow gold" in lower or ("gold" in lower and "white" not in lower and "rose" not in lower):
        gold_note = light_gold_note("yellow gold")
    else:
        gold_note = ""

    # Sketch: short note (not the full rule block, to keep the image prompt minimal).
    sketch_note = ""
    if profile.allows(MODULE_SKETCH) and any(w in lower for w in _SKETCH_WORDS):
        sketch_note = (
            " The reference is a sketch/drawing — interpret it as the intended design and render real, polished, "
            "manufacturable jewelry (do not copy pencil strokes, shading, or paper)."
        )

    variations_block = ""
    if svc._user_wants_variations(user_prompt):
        variations_block = (
            " MULTIPLE VARIATIONS: lay out the requested variations as a clean, evenly-spaced grid of separate "
            "variants on the same pure-white background, all sharing the same base design and differing only by the "
            "requested variation. (This is the ONLY case where more than one piece may appear.)"
        )
    merge_block = ""
    if image_count > 1:
        merge_block = (
            " MULTIPLE REFERENCE IMAGES: the attached images show different parts or views of the SAME single piece. "
            "COMBINE them into ONE unified piece — do NOT output them separately or side by side."
        )

    # "diamond cut" = a metal finish (not diamonds); and if the user named a metal, convert the
    # reference's colours to solid metal (fixes coloured-logo -> solid-gold conversions).
    dcut = diamond_cut_clause(user_prompt)
    metal_convert = metal_conversion_clause(svc._detected_metal_phrase(user_prompt)) if user_named_metal else ""

    return f"""{COMMON_SYSTEM_PROMPT}

{form_line}

{user_request}{sketch_note}{variations_block}{merge_block}{metal_convert}{dcut}{gold_note}

One image only."""


# ---------------------------------------------------------------------------
# TEXT-ONLY branch — fuller, but capability modules are profile-gated.
# ---------------------------------------------------------------------------
def _assemble_text_only(svc, user_prompt, lower, item_type, profile, metal_tone, user_named_metal) -> str:
    # Metal: user-named metal drives it; otherwise the profile default.
    effective_metal = "" if user_named_metal else profile.default_metal
    metal_phrase = f" in {effective_metal}" if effective_metal else ""
    if effective_metal:
        plain_note = (
            f" If the description does not mention diamonds or gemstones, render the piece as plain polished "
            f"{effective_metal} with NO stones added."
        )
    else:
        plain_note = " If the description does not mention diamonds or gemstones, do not add any stones."

    type_line = svc._type_form_clause(item_type, user_prompt)
    font_style_block = ""
    _fs = svc._font_style_clause(user_prompt)
    if _fs:
        font_style_block = f"\n\n{_fs}"
    layered_block = f"\n\n{svc.LAYERED_RULE}" if svc._user_wants_layered(user_prompt) else ""
    variations_block = ""
    if svc._user_wants_variations(user_prompt):
        variations_block = (
            "\n\nMULTIPLE VARIATIONS: lay out several variations of this design as a clean, evenly-spaced grid on "
            "the same pure-white background, each clearly separated, sharing the same base design and differing "
            "only by the requested variation."
        )

    # Profile-gated capability modules (this is the per-type differentiation).
    include_stone = profile.allows(MODULE_STONE)
    include_text = profile.allows(MODULE_TEXT) and (
        profile.text_policy == TEXT_PRIMARY or (profile.text_policy == TEXT_IF_DETECTED and _has_text_intent(user_prompt))
    )

    mod_parts = []
    if include_stone:
        mod_parts.append(svc.SETTING_QUALITY)
        mod_parts.append(svc.STONE_ARRANGEMENT_DEFAULT)
    if include_text:
        mod_parts.append(svc.DOT_CONNECTION_RULE)
    mod_parts.append(svc.REALISM_DESCRIPTOR)  # common to every render
    modules_block = "\n\n".join(mod_parts)

    gold_note = light_gold_note(effective_metal)
    dcut = diamond_cut_clause(user_prompt)
    body = user_prompt if user_prompt else f"a simple plain {item_type}"

    return f"""{COMMON_SYSTEM_PROMPT}

Create a {item_type}{metal_phrase}, front-facing and centered.{type_line}{plain_note}

USER REQUEST (design exactly and only what this describes): {body}{font_style_block}{layered_block}{variations_block}

{modules_block}{gold_note}{dcut}

One image only."""
