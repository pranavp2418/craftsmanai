"""Initial-generation prompt assembler (parse-first, intent-routed — Lovable-style).

`build_initial_prompt(...)` has the SAME signature as the old
`openai_service._build_concise_initial_prompt`, so it is a drop-in replacement.

Structure:
  * COMMON_SYSTEM_PROMPT  -> the shared, adjustable "system" layer.
  * INTENT-DRIVEN focused directive -> chosen from parsedData.intent / source_kind
    (render_as_is, image_enhancement_only, convert_to_jewelry, sketch_to_render, modify_existing,
    text_to_render). This is the "router → one focused template per job" idea from the Lovable
    prototype: build from the parsed structured state, not raw user language.
  * a short type/form line -> only what the jewellery type structurally needs (e.g. pendant bail).
  * USER REQUEST           -> the client's OWN prompt, dominant; plus normalized retailer directives.
  * opt-in modules         -> attached only for text-only renders, gated by the type's profile.

All rule TEXT and detection helpers are read lazily from openai_service (single source of truth);
this module imports nothing from it at import time (no circular imports).
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
from .common import (
    COMMON_SYSTEM_PROMPT, light_gold_note, diamond_cut_clause, metal_conversion_clause,
    normalize_retailer_language, diamond_size_clause,
)


_USER_METAL_WORDS = ["white gold", "rose gold", "yellow gold", "platinum", "silver", "10k", "14k", "18k"]
_SKETCH_WORDS = ["sketch", "drawing", "draw", "hand drawn", "hand-drawn", "pencil", "doodle"]
_TEXT_WORDS = ["name", "initial", "letter", "number", "word", "text", "monogram", "spell", "says", "reads", "font"]
# Stone intent — only add stones (and stone-priming modules) when the user ACTUALLY asks for them.
_STONE_WORDS = [
    "diamond", "stone", "gem", "gemstone", "iced", "ice out", "iced out", "ice-out", "icy",
    "pave", "pavé", "crystal", " cz", "cubic zirconia", "zirconia", "moissanite", "vvs",
    "bust down", "bustdown", "flooded", "baguette", "emerald", "ruby", "sapphire", "birthstone",
    "encrusted", "studded", "bling", "brilliant cut", "set with stone", "stone set", "frozen",
]


def _wants_stones(user_prompt: str) -> bool:
    """True only if the request actually calls for diamonds / gemstones. 'diamond cut' / 'diamond-cut'
    is a metal FINISH (not stones) so it is stripped before the check."""
    p = re.sub(r"diamond[\s-]*cut", "", (user_prompt or "").lower())
    return any(w in p for w in _STONE_WORDS)


def _has_text_intent(user_prompt: str) -> bool:
    p = (user_prompt or "").lower()
    return bool(re.search(r"[0-9]", user_prompt or "")) or any(w in p for w in _TEXT_WORDS)


def _intent_directive(intent: str, source_kind: str, item_type: str, has_user_prompt: bool) -> str:
    """A single focused instruction chosen from the parsed intent (Lovable-style job routing)."""
    if intent == "render_as_is" or (source_kind == "jewelry_reference" and not has_user_prompt):
        return (" Reproduce this EXACT piece as a clean CAD render — do NOT redesign, 'improve', enlarge stones, "
                "simplify, or add anything. Same shape, same every stone, same metal, same lettering.")
    if intent == "image_enhancement_only":
        return (" ENHANCEMENT ONLY (this is NOT a redesign): keep the design 100% identical and only make it a "
                "cleaner, sharper, more premium CAD render.")
    if intent == "convert_to_jewelry" or source_kind == "non_jewelry_reference":
        return (f" CONVERT THIS IMAGE INTO A WEARABLE {item_type.upper()}: keep the subject's overall shape, outline, "
                "proportions and negative space, but render it as REAL 3D metal jewelry (not a flat graphic). Map any "
                "coloured regions to appropriate metal / enamel / gemstone equivalents.")
    if intent == "sketch_to_render" or source_kind == "sketch":
        return (" This is a hand-drawn SKETCH — treat the drawn lines as the intended design and produce a clean, "
                "realistic, manufacturable CAD render of that design. Do NOT copy pencil strokes, shading or paper.")
    return ""  # modify_existing / default -> handled by the normal USER REQUEST


def build_initial_prompt(
    user_prompt: str,
    parsed_data: Optional[Dict[str, Any]],
    metal_tone: str,
    has_images: bool,
    image_count: int = 0,
    font_template: Optional[Dict[str, Any]] = None,
) -> str:
    """Build the initial-generation prompt. Drop-in for _build_concise_initial_prompt.

    When ``font_template`` is provided (a glyph reference for a named font), a dedicated
    letterform-tracing prompt is built so the model copies the EXACT font from the attached template.
    """
    # Lazy import — guarantees no circular import and a single source of truth for rule text.
    from app.services import openai_service as svc

    parsed = parsed_data or {}
    item_type = parsed.get("item_type")
    if not item_type:
        inferred = svc.infer_item_type_from_prompt(user_prompt)
        # infer's catch-all default is 'pendant'; do NOT auto-bail an UNKNOWN piece — only treat it as
        # a pendant when the prompt actually names a hanging type, else stay neutral ('custom', no bail).
        if inferred == "pendant" and not re.search(r"\b(pendant|necklace|charm|chain|bail)\b", (user_prompt or "").lower()):
            item_type = "custom"
        else:
            item_type = inferred
    profile = resolve_profile(item_type)
    lower = (user_prompt or "").lower()
    user_named_metal = any(m in lower for m in _USER_METAL_WORDS)
    intent = (parsed.get("intent") or "").strip().lower()
    source_kind = (parsed.get("source_kind") or "").strip().lower()

    if font_template:
        return _assemble_font_template(svc, user_prompt, lower, item_type, profile, metal_tone, user_named_metal, font_template)
    if has_images:
        return _assemble_image(svc, user_prompt, lower, item_type, profile, image_count, user_named_metal, intent, source_kind)
    return _assemble_text_only(svc, user_prompt, lower, item_type, profile, metal_tone, user_named_metal, intent)


# ---------------------------------------------------------------------------
# IMAGE-INPUT branch — kept intentionally SHORT; user request is dominant.
# ---------------------------------------------------------------------------
def _assemble_image(svc, user_prompt, lower, item_type, profile, image_count, user_named_metal, intent="", source_kind="") -> str:
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

    # Intent-driven focused directive (from the parse-first structured state).
    intent_directive = _intent_directive(intent, source_kind, item_type, bool(user_prompt))

    # USER REQUEST — the client's own prompt, dominant and verbatim, + normalized retailer directives.
    retail = normalize_retailer_language(user_prompt)
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

    # "diamond cut" = a metal finish (not diamonds); convert a coloured logo/graphic to solid metal
    # when a metal is named OR the intent is convert_to_jewelry.
    dcut = diamond_cut_clause(user_prompt)
    # Diamond-size directive when the user asks for stones / iced on the reference (small-dense vs big).
    stone_size = diamond_size_clause(user_prompt) if _wants_stones(user_prompt) else ""
    if user_named_metal:
        metal_convert = metal_conversion_clause(svc._detected_metal_phrase(user_prompt))
    elif intent == "convert_to_jewelry" or source_kind == "non_jewelry_reference":
        metal_convert = metal_conversion_clause("yellow gold")  # default solid metal for a logo conversion
    else:
        metal_convert = ""

    return f"""{COMMON_SYSTEM_PROMPT}

{form_line}{intent_directive}

{user_request}{retail}{sketch_note}{variations_block}{merge_block}{metal_convert}{dcut}{stone_size}{gold_note}

One image only."""


# ---------------------------------------------------------------------------
# FONT-TEMPLATE branch — a glyph reference image guarantees the EXACT named font.
# ---------------------------------------------------------------------------
def _assemble_font_template(svc, user_prompt, lower, item_type, profile, metal_tone, user_named_metal, font_template) -> str:
    """Prompt for the glyph-template case: an attached black-on-white image shows the EXACT font;
    the model must TRACE those letterforms and build them as a 3D piece per the user's design."""
    text = (font_template or {}).get("text") or ""
    font = (font_template or {}).get("font") or ""
    effective_metal = "" if user_named_metal else profile.default_metal
    metal_word = effective_metal or "the requested metal"
    wants_stones = _wants_stones(user_prompt)

    is_pendant = profile.bail_policy in (BAIL_ADD_IF_MISSING, BAIL_PRESERVE) and svc._is_pendant_like(item_type, user_prompt)
    if is_pendant:
        form_line = ("Build the templated lettering as a wearable PENDANT with EXACTLY ONE flared, fan-shaped "
                     "bail at the top-centre for a chain (no chain/cord shown).")
    else:
        form_line = f"Build the templated lettering as a {item_type}.{svc._type_form_clause(item_type, user_prompt)}"

    layered_block = f"\n\n{svc.LAYERED_RULE}" if svc._user_wants_layered(user_prompt) else ""
    if wants_stones:
        stone_note = f"\n\n{svc.SETTING_QUALITY}\n\n{svc.STONE_ARRANGEMENT_DEFAULT}{diamond_size_clause(user_prompt)}"
    else:
        stone_note = (f" Render it as PLAIN, solid, polished {metal_word} — NO diamonds, NO gemstones, NO pavé "
                      "and NO stone settings (none were requested).")
    gold_note = light_gold_note(effective_metal)
    dcut = diamond_cut_clause(user_prompt)
    retail = normalize_retailer_language(user_prompt)

    template_instruction = (
        f"LETTERING TEMPLATE (the attached image): it is a FLAT BLACK-ON-WHITE FONT TEMPLATE showing the "
        f"EXACT letters and the EXACT font/letterform style to use — it is ONLY a font reference, NOT a "
        f"finished piece and NOT artwork to copy as-is. Reproduce these EXACT letter shapes (the \"{font}\" "
        f"font: same proportions, stroke style, spacing and character forms) and build them as a real 3D "
        f"{metal_word} {item_type}. The lettering reads EXACTLY \"{text}\". The template's flat BLACK fill and "
        f"white background are NOT the design — they only convey the letter shapes; render the actual piece in "
        f"{metal_word}. Do NOT change the font, do NOT substitute another style, and do NOT add, drop, mirror, "
        f"or reorder any character."
    )

    return f"""{COMMON_SYSTEM_PROMPT}

{template_instruction}

{form_line}{stone_note}

USER REQUEST (apply these design details to the templated lettering; keep the font EXACTLY as the template): {user_prompt}{retail}{layered_block}{gold_note}{dcut}

One image only."""


# ---------------------------------------------------------------------------
# TEXT-ONLY branch — fuller, but capability modules are profile-gated.
# ---------------------------------------------------------------------------
def _assemble_text_only(svc, user_prompt, lower, item_type, profile, metal_tone, user_named_metal, intent="") -> str:
    effective_metal = "" if user_named_metal else profile.default_metal
    metal_phrase = f" in {effective_metal}" if effective_metal else ""
    wants_stones = _wants_stones(user_prompt)
    metal_word = effective_metal or "metal"
    if wants_stones:
        # User asked for stones — no plain restriction; the stone modules below will guide them.
        plain_note = ""
    else:
        # User did NOT ask for any stones — forbid them explicitly and prominently. (The image model
        # otherwise tends to "ice" name pendants by default; this is the no-stones validation point.)
        plain_note = (
            f" IMPORTANT — NO STONES: the request does NOT mention diamonds or gemstones, so render the "
            f"piece as PLAIN, solid, polished {metal_word} ONLY — a smooth clean metal finish with absolutely "
            f"NO diamonds, NO gemstones, NO pavé, NO crystals, NO stone settings and NO 'iced' surfaces "
            f"anywhere. Metal only."
        )

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

    # Stone-priming modules (SETTING_QUALITY / STONE_ARRANGEMENT_DEFAULT both describe diamonds) are
    # added ONLY when the user actually wants stones — otherwise their presence makes the model add
    # diamonds to a plain piece.
    include_stone = profile.allows(MODULE_STONE) and wants_stones
    include_text = profile.allows(MODULE_TEXT) and (
        profile.text_policy == TEXT_PRIMARY or (profile.text_policy == TEXT_IF_DETECTED and _has_text_intent(user_prompt))
    )

    mod_parts = []
    if include_stone:
        mod_parts.append(svc.SETTING_QUALITY)
        mod_parts.append(svc.STONE_ARRANGEMENT_DEFAULT)
        mod_parts.append(diamond_size_clause(user_prompt).strip())
    if include_text:
        mod_parts.append(svc.DOT_CONNECTION_RULE)
    mod_parts.append(svc.REALISM_DESCRIPTOR)  # common to every render
    modules_block = "\n\n".join(mod_parts)

    gold_note = light_gold_note(effective_metal)
    dcut = diamond_cut_clause(user_prompt)
    retail = normalize_retailer_language(user_prompt)
    body = user_prompt if user_prompt else f"a simple plain {item_type}"

    return f"""{COMMON_SYSTEM_PROMPT}

Create a {item_type}{metal_phrase}, front-facing and centered.{type_line}{plain_note}

USER REQUEST (design exactly and only what this describes): {body}{retail}{font_style_block}{layered_block}{variations_block}

{modules_block}{gold_note}{dcut}

One image only."""
