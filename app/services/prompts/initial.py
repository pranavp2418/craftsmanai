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

    # VARIATIONS request (e.g. "create 6 different variations in yellow gold"). The user wants MULTIPLE
    # DISTINCT designs based on the reference — NOT a 1:1 reproduction. This MUST override the reproduce-
    # as-truth framing below, which otherwise dominates (the image is a strong signal) and returns one
    # identical copy — exactly the TJX-138 bug. Mirrors the text-only variations behaviour: ONE image,
    # a clean grid of N visibly-DIFFERENT variations of the reference, in the requested metal.
    if svc._user_wants_variations(user_prompt):
        _vm = re.search(r"\b([2-9]|1[0-2])\b\s*(?:different\s+|new\s+|design\s+)?(?:variation|version|design|option)", lower)
        n_txt = f"{_vm.group(1)} DISTINCT" if _vm else "several DISTINCT"
        _vmetal = svc._detected_metal_phrase(user_prompt) if user_named_metal else None
        metal_clause = f" Render ALL of them in {_vmetal}." if _vmetal else ""
        # NOTE: deliberately NOT prepending LEAN_IMAGE_MASTER here — its "reproduce that EXACT piece /
        # no proportion changes / reproduce as-is" wording directly contradicts "generate variations" and
        # would dilute the intent back into a 1:1 copy. Lead with the variation intent instead.
        return (
            "You are CraftsmanAI, a precise CAD jewelry render engine. A REFERENCE IMAGE is attached. This "
            "is a DESIGN-VARIATION task — the user wants several DISTINCT variations inspired by the "
            "reference, NOT a 1:1 copy.\n\n"
            f"Generate {n_txt} DESIGN VARIATIONS of the attached piece, laid out as a clean, evenly-spaced "
            "GRID on ONE pure solid white background (#FFFFFF), each variation clearly separated with space "
            "around it. Every variation must stay recognisably the SAME TYPE of piece and keep the "
            "reference's core identity (its overall subject / silhouette), but each must DIFFER MEANINGFULLY "
            "from the others — vary the proportions, stone layout / coverage, border or frame style, accents "
            "and detailing. Do NOT just repeat the same piece; they must be visibly DIFFERENT designs."
            f"{metal_clause} CAD-style realistic jewelry render, crisp, even studio lighting, with "
            "ABSOLUTELY ZERO text, labels or captions anywhere.\n\nOne image only."
        )

    # LOVABLE-EXACT create (WITH image) — Lovable's master + the intent-selected generation directive, filled
    # from the design state. Replaces the old hand-rolled reproduce body. Intent defaults to render_as_is when
    # unset (the common "i need same" case). VARIATIONS (above) and the butterfly->ring form clause (below) are
    # kept as the only justified additions.
    from app.services.prompts.lovable_create import (
        build_lovable_create, metal_phrase as _lov_metal,
        RENDER_AS_IS, IMAGE_ENHANCEMENT, SKETCH_TO_RENDER, CONVERT_TO_JEWELRY,
    )
    _i = (intent or "").strip().lower()
    _sk = (source_kind or "").strip().lower()
    if _i == "image_enhancement_only":
        directive = IMAGE_ENHANCEMENT
    elif _i == "convert_to_jewelry" or _sk == "non_jewelry_reference":
        directive = CONVERT_TO_JEWELRY
    elif _i == "sketch_to_render" or _sk == "sketch":
        directive = SKETCH_TO_RENDER
    else:
        directive = RENDER_AS_IS

    _named_metal = svc._detected_metal_phrase(user_prompt) if user_named_metal else ""
    mp = _lov_metal(True, user_named_metal, _named_metal, _i)
    _note = (user_prompt or "").strip()
    user_request = f"User note: {_note}{normalize_retailer_language(user_prompt)}" if _note else ""
    design_subject = _note or "a jewelry piece"
    stone_phrase = ("Stone setting: set the piece with the diamonds / stones described in the request."
                    if _wants_stones(user_prompt) else "")

    out = build_lovable_create(directive, design_subject=design_subject, item_type=item_type,
                               metal_phrase=mp, stone_phrase=stone_phrase, user_request=user_request)

    # PER-TYPE LAYER (Lovable taxonomy): the type's verbatim default_output_behavior + render-family rule
    # (standalone component for bail/clasp/buckle/body, matching-set layout, custom-object). The verbatim
    # NEGATIVE is appended ONCE at the very end.
    from app.services.prompts.lovable_create import per_type_tail, NEGATIVE_PROMPT
    out += "\n\n" + per_type_tail(item_type, label=design_subject, image_count=image_count, include_negative=False)

    # MULTI-IMAGE authority (Lovable attachmentAuthorityBlock) — first image is the master, never blend.
    if image_count > 1:
        out += ("\n\nMULTIPLE IMAGES: treat the FIRST image as the MASTER reference; use any other ONLY for the "
                "specific part it clearly shows; if they conflict, the FIRST image wins; do NOT blend them into a hybrid.")

    # PER-TYPE FORM / BAIL (kept bug-fixes on top of the Lovable behaviour above):
    #  - SPECIFIC non-pendant type (ring/cufflink/brooch...) -> thin form clause so a flat motif becomes that
    #    type, NOT a default pendant (butterfly->ring fix).
    #  - PENDANT-LIKE -> a custom bail requested (v-bail / rabbit-ear / heart...) REPLACES the bail; else keep
    #    the reference's own bail, or add the client DEFAULT standard loop bail if it has none. ("Render pendant
    #    alone (no chain)" + "avoid duplicate bail/chain" already come from the per-type tail + the NEGATIVE.)
    _ct = (item_type or "").strip().lower()
    _generic_type = (not _ct) or _ct in ("jewelry", "jewellery", "custom", "custom object", "other", "charm")
    _pendant_like = svc._is_pendant_like(item_type, user_prompt) or profile.bail_policy == BAIL_ADD_IF_MISSING
    if not _generic_type and not _pendant_like:
        out += (f"\n\nForm: present the design as the requested {item_type}:{svc._type_form_clause(item_type, user_prompt)} "
                f"It is a wearable {item_type} — NOT a pendant or charm: do NOT add any bail, hook, jump-ring or chain hole.")
    elif _pendant_like:
        if re.search(r"\b(v[-\s]?bail|rabbit\s*ear\s*bail|enhancer\s*bail|hinge\s*bail|hidden\s*bail|logo\s*bail|heart\s*bail|puffy\s*heart\s*bail|custom\s*bail)\b", lower):
            out += ("\n\nPENDANT BAIL — custom bail requested: REPLACE the existing/default bail with the "
                    "user-specified bail. Do NOT stack two bails. Do NOT keep both.")
        else:
            out += ("\n\nBail: keep the reference's OWN bail if it already has one (do NOT duplicate it). If it has "
                    "NONE, add ONE classic STANDARD LOOP BAIL in the same metal — a smooth, polished bail with a "
                    "gently FLARED, softly rounded top that TAPERS downward into a small round loop / jump-ring at "
                    "its base for the chain — fixed at the very top of the pendant, facing forward.")

    out += "\n\n" + NEGATIVE_PROMPT
    return out


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
    # LOVABLE-EXACT create (WITHOUT image) — master + the text_to_render directive. The iced bust-down branch
    # (above) and the variations grid (below) are kept as the only additions; the no-stones forbid is folded
    # into Lovable's {stone_phrase} placeholder, and a thin yellow-gold colour note is appended (validated:
    # explicit yellow gold otherwise renders copper/glossy).
    from app.services.prompts.lovable_create import build_lovable_create, metal_phrase as _lov_metal, TEXT_TO_RENDER
    _named_metal = svc._detected_metal_phrase(user_prompt) if user_named_metal else ""
    mp = _lov_metal(False, user_named_metal, _named_metal, "text_to_render")
    if wants_stones:
        stone_phrase = "Stones: set the piece with the diamonds / stones described in the request."
    else:
        # No stones requested — Lovable's {stone_phrase} carries the explicit plain-metal instruction (the
        # image model otherwise ices name pendants by default; this is the validated no-stones point).
        stone_phrase = (f"Stones: NONE — render as PLAIN, solid, polished {metal_word} ONLY, with absolutely NO "
                        "diamonds, gemstones, pavé, crystals or 'iced' surfaces anywhere. Metal only.")
    body = user_prompt if user_prompt else f"a simple plain {item_type}"
    out = build_lovable_create(TEXT_TO_RENDER, item_type=item_type, metal_phrase=mp, stone_phrase=stone_phrase,
                               user_request=f"{body}{normalize_retailer_language(user_prompt)}")
    # PER-TYPE LAYER (Lovable taxonomy) — the type's default_output_behavior + render-family rule; NEGATIVE last.
    from app.services.prompts.lovable_create import per_type_tail, NEGATIVE_PROMPT
    out += "\n\n" + per_type_tail(item_type, label=(user_prompt or item_type), include_negative=False)
    _is_yellow_gold = (("yellow gold" in lower) or ("gold" in lower and "white" not in lower and "rose" not in lower)
                       or (mp == "yellow_gold_default"))
    if _is_yellow_gold:
        out += f"\n\n{light_gold_note('yellow gold')}"
    if svc._user_wants_variations(user_prompt):
        out += ("\n\nMULTIPLE VARIATIONS: lay out several variations of this design as a clean, evenly-spaced grid "
                "on the same pure-white background, each clearly separated, sharing the same base design and "
                "differing only by the requested variation.")
    out += "\n\n" + NEGATIVE_PROMPT
    return out
