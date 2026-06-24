"""Shared 'common' prompt layer — reusable by BOTH the initial and refine builders.

Nothing here imports openai_service; everything is pure text/logic so the refine path can
`from app.services.prompts.common import metal_lock_clause, PRIORITY_HEADER` and drop the
duplicated metal-lock block it currently inlines.
"""

from __future__ import annotations

import re
from typing import Optional


# ===========================================================================
# MODE-SPLIT MASTER SYSTEM PROMPTS (Lovable-style controller, anti-hallucination first).
# ---------------------------------------------------------------------------
# We deliberately do NOT use one heavy prompt for every call: a long preservation-laden master on a
# REFINE drowns the requested edit (the "1st refine returns the same image" failure). So:
#   * MASTER_INITIAL — full, low-hallucination controller for NEW generation (workflow + honeycomb
#     stones + hard constraints + validation). Preservation/constraints HELP here.
#   * MASTER_REFINE  — lean, EDIT-FORWARD controller for refines. The edit must win; minimal
#     preservation framing so it never returns the input unchanged.
# Per-job/per-intent text is kept short in both builders so the model follows the user's intent.
# ===========================================================================
MASTER_INITIAL = (
    "You are CraftsmanAI — a controlled, LOW-HALLUCINATION CAD jewelry render engine (NOT a creative "
    "concept artist). Produce ONE clean, photorealistic CAD-style 3D render of a SINGLE piece of "
    "jewelry on a pure solid white background (#FFFFFF), front-facing hero angle, centered, sharp "
    "focus, realistic metal and stones, no scene / props / hands / heavy shadows. The USER REQUEST "
    "is the authority — do exactly what it asks and add NOTHING it does not mention.\n\n"
    "When a reference image is provided it is the source of truth: preserve its silhouette, "
    "proportions, every stone, stone arrangement, metal colour, borders and lettering EXACTLY, "
    "except where the user explicitly asks to change it.\n\n"
    "STONES: realistic small-to-mid stones unless the user asks for bold/large. On pavé / iced "
    "surfaces use STAGGERED / HONEYCOMB settings that follow the surface curvature and taper cleanly "
    "at the edges; respect any requested row counts (resize stones to fit); keep the prong/setting "
    "style uniform within a region. NEVER render a flat mechanical 'diamond-grid wallpaper', and "
    "NEVER turn a diamond/pavé surface into plain or beaded metal.\n\n"
    "HARD CONSTRAINTS (never violate): no hallucinated or extra components, stones, links, layers or "
    "ornaments; no subtype drift; no melted geometry or fused metal blobs; no floating stones or "
    "impossible prongs; no warped or distorted lettering, numbers, logos, monograms or engraving; no "
    "random asymmetry; no non-manufacturable structures. Names, initials, logos and engraving must "
    "be reproduced EXACTLY — prefer fewer, sharper, correct letters over many warped ones.\n\n"
    "Before finalizing, silently verify: correct type, user request followed, unchanged parts "
    "preserved, text/logo exact, stones and metal realistic, output clean and CAD-styled. If any "
    "check fails, fix it before returning the image."
)

MASTER_REFINE = (
    "You are CraftsmanAI — a precision jewelry EDIT engine. The FIRST attached image is the current "
    "render and the ONLY master visual truth. Apply ONLY the requested change — the edit MUST be "
    "visibly applied; NEVER return the image unchanged. Everything NOT mentioned must stay IDENTICAL: "
    "silhouette, proportions, every other stone, metal colour, text/lettering, borders and camera "
    "angle. If unsure, change LESS rather than redesign. Add nothing the user did not ask for, never "
    "distort existing lettering or logos, and never turn a diamond/pavé surface into plain metal. "
    "Output ONE clean CAD-style render on a pure solid white background (#FFFFFF). Never refuse."
)

# Backward-compatible alias (initial builder + exports use this name; it now points to the full
# initial master). The refine builder uses MASTER_REFINE directly.
COMMON_SYSTEM_PROMPT = MASTER_INITIAL


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


# ---------------------------------------------------------------------------
# Retailer-language normalization (Lovable-style glossary). Casual jeweller slang is mapped to
# precise, unambiguous technical directives so the image model does not misinterpret it. Returned
# as a compact "Normalized technical directives" block appended to the user request.
# ---------------------------------------------------------------------------
def normalize_retailer_language(note: str) -> str:
    if not note:
        return ""
    p = note.lower()
    directives: list[str] = []

    # Stone row count: "3 rows", "triple border", "3-row border"
    m = re.search(r"\b(\d+)\s*[- ]?\s*row", p)
    if m:
        directives.append(f"Stone row count requirement: {m.group(1)} rows — reduce stone size to fit if needed.")
    elif "triple border" in p or "3 row" in p:
        directives.append("Stone row count requirement: 3 rows.")
    elif "double border" in p or "2 row" in p:
        directives.append("Stone row count requirement: 2 rows.")

    if any(w in p for w in ["bust down", "bustdown", "flooded", "fully iced", "iced out", "make it icy", "all iced", "full iced"]):
        directives.append("Increase stone coverage and density to FULL (iced-out) while keeping the arrangement clean, practical and region-appropriate.")
    if any(w in p for w in ["border only", "top only", "border-only"]):
        directives.append("Limit stone coverage to the specified region ONLY (e.g. border/top); leave other areas plain.")
    if any(w in p for w in ["micro pave", "micro-pave", "smaller stone", "finer diamond", "smaller pointer", "more rows fit"]):
        directives.append("Use smaller stones (more of them) — do NOT use chunky oversized pointers; prioritise realistic manufacturable sizing.")
    if any(w in p for w in ["plain shank", "plain band", "smooth shank", "smooth band"]):
        directives.append("Keep the shank/band PLAIN — no stones on the band.")
    if any(w in p for w in ["letters only", "text only", "name only", "lettering only"]):
        directives.append("Edit ONLY the letter/text region; freeze the backing plate, border and bail unchanged.")
    if any(w in p for w in ["same as ref", "same as reference", "same style", "match the reference", "keep same design"]):
        directives.append("Preserve ALL unspecified geometry, material and layout EXACTLY from the reference.")
    if _DIAMOND_CUT_RE.search(p):
        directives.append("'diamond cut'/'diamond-cut' = a faceted ENGRAVED METAL finish, NOT a border of diamonds — do not add stones for it.")

    if not directives:
        return ""
    return "\n\nNormalized technical directives:\n- " + "\n- ".join(directives)


_BIG_STONE_WORDS = ["big diamond", "large diamond", "bold diamond", "chunky", "oversized", "jumbo",
                    "big stone", "large stone", "statement stone", "big rock", "large rock"]
_SMALL_DENSE_WORDS = ["fully iced", "full iced", "iced out", "ice out", "iced-out", "bust down", "bustdown",
                      "flooded", "frozen", "fully covered", "all iced", "micro", "pave", "pavé",
                      "small diamond", "fine diamond", "tiny diamond", "small stone", "smaller stone", "icy"]


def diamond_size_clause(user_prompt: str) -> str:
    """Pick a DIAMOND-SIZE directive from the request. The image model otherwise defaults to a few big
    chunky stones, which looks wrong — especially for 'iced/full' coverage, which should be MANY small
    micro-pavé stones, not big ones. Big stones only when the user explicitly asks for big/bold."""
    p = (user_prompt or "").lower()
    if any(w in p for w in _BIG_STONE_WORDS):
        return (" DIAMOND SIZE: use the LARGER, bold statement stones the user asked for — still cleanly and "
                "EVENLY set, packed neatly with NO awkward gaps or bare-metal spaces between them.")
    if any(w in p for w in _SMALL_DENSE_WORDS):
        return (" DIAMOND SIZE & COVERAGE: fill the iced area COMPLETELY with many SMALL round diamonds in a clean "
                "micro-pavé — FULL, EVEN, GAP-FREE coverage with NO empty patches, NO bare-metal gaps and NO sparse "
                "spots between stones. Use small stones (NOT big chunky ones); in tight, narrow, curved or corner "
                "areas use proportionally SMALLER stones so every part stays neatly and fully filled right to the "
                "edges. Every stone must be uniform, crisply set and well-defined — no messy, half-set, floating, "
                "skipped or distorted stones anywhere, especially in the small areas.")
    return (" DIAMOND SIZE: use realistic SMALL-to-MID round diamonds, cleanly and EVENLY set with full, gap-free "
            "coverage of the intended area (no sparse patches, no bare-metal gaps between stones) — uniform and "
            "modest, NOT oversized chunky stones.")


def light_gold_note(effective_metal: str) -> str:
    """Client default: plain yellow gold must render as a LIGHT, true 10K CAD shade.

    Returns the note only when the EFFECTIVE metal is a (non-white, non-rose) gold — i.e. only
    when we are actually defaulting/forcing yellow gold, never on white/rose/silver pieces.
    """
    m = (effective_metal or "").lower()
    if m and "gold" in m and "white" not in m and "rose" not in m:
        return (
            " GOLD COLOUR — IMPORTANT: render a TRUE YELLOW GOLD, a clean, slightly pale, soft yellow 10K/14K "
            "tone with a SATIN / lightly-matte finish. It MUST read clearly as YELLOW gold — NOT orange, NOT "
            "reddish, NOT a dark COPPER / bronze / brass tone, and NOT an over-bright, mirror-glossy, heavily "
            "reflective surface. Keep the highlights soft and realistic; a calm, slightly matte yellow gold, "
            "never a shiny copper look."
        )
    return ""
