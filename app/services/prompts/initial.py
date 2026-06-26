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
    COMMON_SYSTEM_PROMPT, LEAN_IMAGE_MASTER, light_gold_note, diamond_cut_clause, metal_conversion_clause,
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
        return (" Reproduce ONLY the EXACT jewelry PIECE as a clean CAD render — do NOT redesign, 'improve', "
                "enlarge stones, simplify, or add anything. Same shape, same every stone, same metal, same "
                "lettering ON the piece. Do NOT reproduce any surrounding notes, captions, dimensions, or text "
                "that appear around the piece in the reference — only the piece itself.")
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

    # The client's own words are dominant. NO prompt -> a pure AS-IS reproduce (nothing added).
    retail = normalize_retailer_language(user_prompt)
    if svc._is_metal_only_change(user_prompt):
        mp = svc._detected_metal_phrase(user_prompt) or "the requested metal"
        user_request = (f"\n\nUSER REQUEST: change ONLY the metal colour to {mp}. Keep the design and EVERY stone "
                        "identical to the reference image.")
    elif (user_prompt or "").strip():
        user_request = f"\n\nUSER REQUEST (apply this to the reproduced piece, change NOTHING else): {user_prompt}{retail}"
    else:
        user_request = ""  # client wants it exactly AS-IS

    # ONLY user-DRIVEN clarifiers below — never our-side extras (no forced bail, no default stone rules,
    # no honeycomb, no gold-note: the image's own design/metal/bail is the truth).
    # (The sketch / logo / jewelry-photo cases are now self-classified IN-PROMPT in the reproduce clause
    # below, so the model routes them from the attached image itself — no separate text-gated clause.)
    # Multi-image AUTHORITY (Lovable-style): the FIRST image is the master; others are support-only; never blend.
    merge_block = ""
    if image_count > 1:
        merge_block = (" MULTIPLE IMAGES: treat the FIRST image as the MASTER reference (its geometry, stones, metal "
                       "and silhouette); use any other image ONLY for the specific part it clearly shows. Do NOT "
                       "average or blend the images into a new hybrid design unless the request explicitly asks to "
                       "combine them; if they conflict, the FIRST image wins.")
    dcut = diamond_cut_clause(user_prompt)
    # Convert a flat coloured logo/graphic into solid metal ONLY when the user names ONE metal. Do NOT force
    # a single metal for a TWO-TONE request ("rose gold mainly + top layer white gold") — naming just the
    # first-detected metal overrode the user's words and rendered the whole piece one colour. For two-tone we
    # add nothing here and let the user's VERBATIM prompt carry both metal colours.
    metal_convert = (metal_conversion_clause(svc._detected_metal_phrase(user_prompt))
                     if (user_named_metal and svc.extract_metal_from_prompt(user_prompt) != "two_tone") else "")
    no_annotation_note = (
        " OUTPUT THE JEWELRY ONLY — EXCLUDE ALL NOTE / SPEC TEXT: the reference may carry a written brief for the "
        "jeweler — metal karat (e.g. '10KT'), measurements (e.g. '45mm', '3mm'), quality grades (e.g. 'VS/SI'), "
        "prices, budgets, dates or notes. That text is an INSTRUCTION for you, NOT part of the design — do NOT "
        "render ANY of it as metal, engraving or a plate. Build ONLY the actual jewelry DESIGN (the name, figure, "
        "motif or shape itself); keep lettering ONLY when it is clearly the DESIGN (e.g. the name that goes on the "
        "piece). The final image must show ONLY the single finished jewelry piece on a pure white background — no "
        "notes, dimensions, labels, captions, arrows or watermarks.")

    # When CONVERTING a flat design (logo/figure/motif) into jewelry, apply it to the FORM the user actually
    # asked for (their selected jewellery_type / prompt) — do NOT default to a pendant + bail if a RING,
    # bracelet, earring etc. is requested. (A butterfly + "a gold RING with this on it" was coming out as a
    # pendant because the conversion hard-coded "add a bail".)
    _ct = (item_type or "").strip().lower()
    _generic_type = (not _ct) or _ct in ("jewelry", "jewellery", "custom", "custom object", "other", "charm")
    if svc._is_pendant_like(item_type, user_prompt) or _generic_type:
        _convert_form = (" and add a single bail at the very TOP (facing FORWARD, above the design, not behind) so it "
                         "hangs as a pendant, rendered in the requested metal")
    else:
        _convert_form = (f" and present it as the requested {item_type}:{svc._type_form_clause(item_type, user_prompt)} "
                         "Apply the design as its FACE / motif. Do NOT add a pendant bail. Rendered in the requested metal")

    return f"""{LEAN_IMAGE_MASTER}

Reproduce this reference image as a clean, photorealistic CAD-style 3D jewelry render on a pure solid white background (#FFFFFF), {angle_phrase}, sharp focus. The reference is the SOURCE OF TRUTH — keep its EXACT design, silhouette, every stone and arrangement, metal colour, borders, lettering, negative space (cut-outs / gaps between elements) AND its own bail / hook / connection. Do NOT add, remove, simplify or 'improve' anything the user did not explicitly ask for — no default bail, no extra ornaments, no invented stones. If the reference is a real jewelry photo or CAD render, reproduce it 1:1. If it is a FLAT 2D design — a hand sketch, line-art, silhouette, logo, name or lettering on a plain background (NOT a photograph of an existing 3D piece) — do NOT output a flat copy: BUILD it as a real, wearable 3D metal jewelry piece, but keep its DESIGN EXACT. TRACE the design faithfully — the SAME letterforms (every stroke, curve, tail, loop and join, and the EXACT cursive / script / block style), the SAME silhouette, shapes, proportions, spacing, layout and negative space (open windows / gaps between letters). Do NOT restyle the font, redraw, swap, simplify, smear or improvise ANY character or shape — the design is the source of truth. ONLY give the design real raised 3D geometry (depth + side walls), set the faces with neat pavé diamonds when it reads as a name / charm / iced piece,{_convert_form}.{merge_block}{user_request}{metal_convert}{dcut}{no_annotation_note}

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
    # Apply the gold-colour guidance whenever the piece is YELLOW gold — whether the USER named it
    # ("yellow gold"/"gold") OR it's the profile default. (Previously, a user-named metal blanked
    # effective_metal, so explicit "yellow gold" requests got NO gold-colour note -> copper/glossy look.)
    _is_yellow_gold = (("yellow gold" in lower) or ("gold" in lower and "white" not in lower and "rose" not in lower)
                       or ("gold" in (effective_metal or "") and "white" not in (effective_metal or "") and "rose" not in (effective_metal or "")))
    gold_note = light_gold_note("yellow gold") if _is_yellow_gold else ""
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

    # FULLY-ICED NAME / TEXT pendant -> a LEAN, ICE-DOMINANT prompt. Validated empirically: the full builder
    # stack (master + bail + font + note + modules, ~2800 chars) drowned the "fully iced" signal and the
    # model reverted to its default OUTLINED-cursive look (diamond border + polished letter faces); a short
    # prompt where the solid-diamond surface is the dominant theme fully-paves the letter faces, matching the
    # Lovable output. So for iced name/text pieces we bypass the heavy stack entirely.
    _iced = any(w in lower for w in ("fully iced", "iced out", "ice out", "iced-out", "bust down",
                                     "bustdown", "flooded", "frozen", "fully covered", "all iced"))
    if _iced and _has_text_intent(user_prompt):
        metal_named = svc._detected_metal_phrase(user_prompt) or (effective_metal or "white gold")
        bail_line = " Add ONE simple loop bail at the top for a chain." if profile.bail_policy != "none" else ""
        return (
            "You are CraftsmanAI, a precise CAD jewelry render engine. Produce ONE clean, photorealistic "
            "CAD-style 3D render on a pure solid white (#FFFFFF) background, sharp focus.\n\n"
            f"Create a fully ICED-OUT {item_type} in {metal_named}, built exactly from the design below."
            f"{bail_line}\n\n"
            "BUST-DOWN — 100% DIAMOND COVERAGE: every letter and every surface is a SOLID SHEET of small "
            "micro-pavé diamonds. The diamonds fill the FULL WIDTH of every stroke, so each letter FACE is "
            "entirely diamonds edge to edge; metal shows ONLY as the thin prong walls between touching "
            "stones. If a two-layer / step-up is mentioned, that is for DEPTH only — BOTH layers are equally "
            "fully iced. Render the lettering in the exact font/style the design describes.\n\n"
            f"DESIGN: {user_prompt}\n\n"
            "One clean image only."
        )
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
    # FULLY ICED detection (used to keep the iced path lean + Lovable-like).
    _fully_iced = any(w in lower for w in ("fully iced", "iced out", "ice out", "iced-out", "bust down",
                                           "bustdown", "flooded", "frozen", "fully covered", "all iced"))
    # For an ICED piece, DROP our structural LAYERED_RULE entirely — Lovable gives NO step-up structural
    # description; the user's own "2 layer / step-up" note + the iced clause (which covers BOTH tiers) handle
    # it. Our extra "tiers / backing / ledge" framing biased the model toward outlined-metal letters.
    layered_block = (f"\n\n{svc.LAYERED_RULE}" if (svc._user_wants_layered(user_prompt) and not _fully_iced) else "")
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

    # When the piece is FULLY ICED, the strong diamond_size_clause (solid total coverage) is the authority;
    # the "parallel rows" STONE_ARRANGEMENT_DEFAULT competes with it (suggests a directional outline pattern),
    # so drop it for iced pieces and let the solid-coverage clause dominate. (_fully_iced computed above.)
    # FULLY ICED: the coverage clause must LEAD (placed right after the type line, BEFORE the user request)
    # so the "solid diamond surface" signal dominates — buried at the end it lost to the model's default
    # outlined-cursive look (validated: a lean, ice-leading prompt fully-paves the letter faces). It is put
    # in `iced_lead` (added to the return below), NOT in mod_parts. Non-iced: the usual stone modules.
    iced_lead = ""
    mod_parts = []
    if include_stone:
        if _fully_iced:
            iced_lead = diamond_size_clause(user_prompt)
        else:
            mod_parts.append(svc.SETTING_QUALITY)
            mod_parts.append(svc.STONE_ARRANGEMENT_DEFAULT)
            mod_parts.append(diamond_size_clause(user_prompt).strip())
    # DOT_CONNECTION_RULE is about LETTERING (floating 'i'/'j' dots) — only relevant when the piece
    # actually has text/letters, so gate it on real text intent. Skip it on fully-iced names to stay lean.
    if include_text and _has_text_intent(user_prompt) and not _fully_iced:
        mod_parts.append(svc.DOT_CONNECTION_RULE)
    # (REALISM_DESCRIPTOR removed — its CAD-look essence is now folded into the lean MASTER_INITIAL, so a
    # PLAIN piece gets no extra always-on module block at all.)
    modules_block = "\n\n".join(mod_parts)

    # Apply the gold-colour guidance whenever the piece is YELLOW gold — whether the USER named it
    # ("yellow gold"/"gold") OR it's the profile default. (Previously, a user-named metal blanked
    # effective_metal, so explicit "yellow gold" requests got NO gold-colour note -> copper/glossy look.)
    _is_yellow_gold = (("yellow gold" in lower) or ("gold" in lower and "white" not in lower and "rose" not in lower)
                       or ("gold" in (effective_metal or "") and "white" not in (effective_metal or "") and "rose" not in (effective_metal or "")))
    gold_note = light_gold_note("yellow gold") if _is_yellow_gold else ""
    dcut = diamond_cut_clause(user_prompt)
    retail = normalize_retailer_language(user_prompt)
    body = user_prompt if user_prompt else f"a simple plain {item_type}"

    return f"""{COMMON_SYSTEM_PROMPT}

Create a {item_type}{metal_phrase}, front-facing and centered.{type_line}{iced_lead}{plain_note}

USER REQUEST (design exactly and only what this describes): {body}{retail}{font_style_block}{layered_block}{variations_block}

{modules_block}{gold_note}{dcut}

One image only."""
