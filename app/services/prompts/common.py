"""Shared 'common' prompt layer — reusable by BOTH the initial and refine builders.

Nothing here imports openai_service; everything is pure text/logic so the refine path can
`from app.services.prompts.common import metal_lock_clause, PRIORITY_HEADER` and drop the
duplicated metal-lock block it currently inlines.
"""

from __future__ import annotations

import re
from typing import Optional


# ===========================================================================
# COMMON_SYSTEM_PROMPT — the single, adjustable "system" layer for EVERY render.
# ---------------------------------------------------------------------------
# This is the one place to tune the shared framing. It establishes WHAT to produce and HOW to
# behave, and — most importantly — that the USER's own request is the authority: do exactly what
# the user asks, change only what they ask, add nothing they didn't. The user's prompt is then
# appended verbatim as the "USER REQUEST" so the client's wording drives the result.
# Kept deliberately concise so it does not bloat image-input prompts (long prompts hurt
# gpt-image-2 pavé fidelity). Reusable by the refine builder too.
# ===========================================================================
COMMON_SYSTEM_PROMPT = (
    "You are a precise CAD jewelry render engine. Produce ONE clean, photorealistic CAD-style 3D "
    "render of a single piece of jewelry on a pure solid white background (#FFFFFF), with sharp "
    "focus, realistic metal and stones, and no background scene. "
    "The USER REQUEST is the authority: do exactly what it asks, change ONLY what it asks to "
    "change, and add nothing it does not mention. When a reference image is provided, treat that "
    "image as the source of truth and preserve every detail — shape, proportions, every stone, "
    "metal colour, borders and lettering — except where the user explicitly asks to change it; "
    "never turn a diamond/pavé surface into plain metal."
)


# Conflict-resolution header. When two instructions touch the same thing, this tells the model
# who wins — so "apply the user's change" can never be cancelled by a preservation rule, and a
# type default never overrides the reference geometry. Kept out of the SHORT image prompt; use
# it for the fuller text-only / refine prompts.
PRIORITY_HEADER = (
    "PRIORITY ORDER (when instructions conflict, the higher one wins): "
    "1) the user's explicit request, "
    "2) the reference image's actual geometry and stones, "
    "3) the jewellery type's default form, "
    "4) house render style. "
    "A preservation rule applies only where it does not block the user's requested change."
)

# Minimal output contract shared by every render.
OUTPUT_CONTRACT = (
    "Render a clean CAD-style 3D jewelry image on a pure solid white background (#FFFFFF), "
    "sharp focus, realistic metal and stones, no background scene. One image only."
)


def metal_lock_clause(ref_metal: Optional[str], wants_metal_change: bool) -> str:
    """Return a metal-colour lock clause naming the detected metal explicitly.

    Mirrors the refine builder's metal-lock logic in ONE place so both builders can share it.
    Returns "" when the user actually asked to change the metal (then it must NOT be locked).
    White metals drift to gold strongly, so they get a forceful clause.
    """
    if wants_metal_change:
        return ""
    rm = (ref_metal or "").lower()
    if rm in ("silver", "white_gold", "white gold", "platinum"):
        return (
            " CRITICAL METAL COLOUR — the piece is WHITE GOLD (bright, cool, silvery-white, like rhodium / "
            "platinum). Render EVERY metal surface — frame, every letter, bail, borders, prongs and back — in "
            "BRIGHT COOL SILVERY-WHITE metal. There must be absolutely NO yellow, NO gold, NO brass, NO warm or "
            "champagne tint ANYWHERE on the metal. Do NOT turn it gold — 100% of the metal must read as clean "
            "white/silver, exactly like the reference."
        )
    if rm in ("rose_gold", "rose"):
        return (
            " CRITICAL METAL COLOUR — the piece is ROSE GOLD (a warm pink-copper gold). Render ALL metal "
            "surfaces in that SAME rose gold; do NOT change it to yellow gold or any other colour."
        )
    if rm and "two" in rm:
        return (" CRITICAL METAL COLOUR — keep the EXACT same TWO-TONE metal combination as the "
                "reference; do NOT change any area's metal colour.")
    if rm in ("yellow_gold", "gold"):
        return (" CRITICAL METAL COLOUR — the piece is YELLOW GOLD; keep it yellow gold and do NOT "
                "change the metal colour.")
    return (" CRITICAL — KEEP THE EXACT SAME METAL COLOUR/TONE as the reference image (rose stays "
            "rose, yellow stays yellow, white stays white, two-tone stays two-tone). Do NOT change, "
            "warm, cool, or yellow the metal colour.")


_DIAMOND_CUT_RE = re.compile(r"diamond[\s-]*cut", re.I)


def diamond_cut_clause(user_prompt: str) -> str:
    """'Diamond cut' / 'diamond-cut' is a METAL FINISHING technique (faceted engraved sparkle
    cuts worked into the metal) — NOT actual diamonds. The model otherwise adds diamond stones or
    a beaded border. Returns a clarifying clause when the term is present, else ''."""
    if not user_prompt or not _DIAMOND_CUT_RE.search(user_prompt):
        return ""
    return (
        " DIAMOND-CUT FINISH: here \"diamond cut\" / \"diamond-cut\" is a METAL FINISHING technique — crisp, "
        "machine-faceted, engraved sparkle cuts worked INTO the gold/metal surface and edges (tiny reflective "
        "facets that catch the light). It is NOT actual diamond stones: do NOT add any diamonds, gemstones, "
        "pavé, or a beaded/granulated border for it. Apply the diamond-cut as a faceted engraved texture in the "
        "metal itself along the specified edges/surface."
    )


def metal_conversion_clause(metal_phrase: Optional[str]) -> str:
    """When an image reference is a flat / coloured graphic or logo and the user wants it in a
    metal, render the WHOLE piece in solid metal (convert the reference's colours) instead of
    keeping the flat colours. Gemstones keep their natural colour. Returns '' if no metal given."""
    if not metal_phrase:
        return ""
    m = metal_phrase
    return (
        f" SOLID METAL: render the ENTIRE piece in solid {m}. The reference image provides the SHAPE and "
        f"DESIGN only — convert ALL of its flat colours, enamel and fills into {m} so the whole body reads as "
        f"one solid {m} 3D CAD metal piece, NOT a flat coloured graphic. (Keep any ACTUAL gemstones their "
        f"natural colour — do not turn stones into metal.) Do NOT keep the reference's flat/enamel colours "
        f"unless the user explicitly asked for coloured enamel."
    )


def light_gold_note(effective_metal: str) -> str:
    """Client default: plain yellow gold must render as a LIGHT, true 10K CAD shade.

    Returns the note only when the EFFECTIVE metal is a (non-white, non-rose) gold — i.e. only
    when we are actually defaulting/forcing yellow gold, never on white/rose/silver pieces.
    """
    m = (effective_metal or "").lower()
    if m and "gold" in m and "white" not in m and "rose" not in m:
        return (
            " Render the gold as a LIGHT, soft, true 10K CAD-style gold shade (a lighter, realistic, slightly "
            "matte gold) — NOT a bright, saturated, glossy yellow gold."
        )
    return ""
