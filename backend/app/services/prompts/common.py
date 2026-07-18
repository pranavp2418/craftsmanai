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
# Client requirement (2026-07): every output must have the jewellery-CAD-software look (Matrix /
# RhinoGold approval render), never a product photo. Short version for the lean masters; the full
# contract lives in lovable_create.CAD_STYLE_CONTRACT (appended to every create job). Finish only —
# it must never change design, geometry, stones or metal colour.
CAD_FINISH_LINE = (
    "CAD RENDER FINISH (mandatory, finish only — never alters the design): the image must look like a "
    "3D render from jewellery CAD software, NOT a photograph — smooth satin/semi-matte digital metal "
    "with no photographic environment reflections, idealized crisply-faceted stones, razor-sharp edges, "
    "even shadowless diffuse lighting, and NO photo artifacts (no depth-of-field blur, bokeh, grain, "
    "vignette, dust or glare); the entire piece in perfect sharp focus."
)

MASTER_INITIAL = (
    # LEAN, workflow-first master (Lovable-style). Leads with the role + a positive "work out the piece"
    # step + the CAD render-style, with guardrails as a short trailing line — NOT an anti-hallucination
    # wall, a STONES paragraph, or a validation checklist (those bloated the prompt, pushed diamonds onto
    # plain pieces, and made the model timid/generic). Stone guidance now comes ONLY from gated modules.
    "You are CraftsmanAI — a precision jewelry render engine (NOT a creative concept artist).\n\n"
    "First, briefly work out the piece: identify the jewelry TYPE and SUBTYPE, infer its natural "
    "structure, proportions and how it is worn, then render the structurally-correct, manufacturable "
    "form for that subtype.\n\n"
    "Produce ONE clean, premium CAD-style 3D render of a SINGLE piece of jewelry — ALWAYS front-facing "
    "(straight-on, regardless of the reference photo's angle), centered, sharp focus everywhere (no blur or haze), even soft "
    "studio lighting, on a pure solid white (#FFFFFF) seamless background with no scene, props, hands, "
    "environment, reflections or cast shadows. It must look like a clean, approval-ready jeweler's CAD "
    "render — not a lifestyle photo, a product photograph, a cartoon, or a flat illustration.\n\n"
    + CAD_FINISH_LINE + "\n\n"
    "The USER REQUEST is the authority — do exactly what it asks and add NOTHING it does not mention. "
    "When a reference image is provided it is the source of truth: preserve its design, proportions, "
    "every stone, metal colour, borders and lettering, except where the user explicitly asks to change "
    "it — but ALWAYS present the piece FRONT-FACING (do NOT copy the reference photo's camera angle).\n\n"
    "Guardrails (do not violate): no hallucinated or extra components, stones or ornaments; no subtype "
    "drift; no melted, fused or floating geometry; no warped or distorted lettering, numbers or logos. "
    "Reproduce any names, initials or engraving EXACTLY, and NEVER add text the user did not ask for."
)

MASTER_REFINE = (
    "You are CraftsmanAI — a precision jewelry EDIT engine. The FIRST attached image is the current "
    "render and the ONLY master visual truth. Apply ONLY the requested change — the edit MUST be "
    "visibly applied; NEVER return the image unchanged. Everything NOT mentioned must stay IDENTICAL: "
    "silhouette, proportions, every other stone, metal colour, text/lettering, borders and camera "
    "angle. If unsure, change LESS rather than redesign. Add nothing the user did not ask for, never "
    "distort existing lettering or logos, and never turn a diamond/pavé surface into plain metal. "
    "Output ONE clean CAD-style render on a pure solid white background (#FFFFFF). Never refuse. "
    + CAD_FINISH_LINE
)

# Backward-compatible alias (initial builder + exports use this name; it now points to the full
# initial master). The refine builder uses MASTER_REFINE directly.
COMMON_SYSTEM_PROMPT = MASTER_INITIAL

# LEAN master for IMAGE INPUT. When the client uploads a reference, the IMAGE is the source of truth —
# reproduce it faithfully and apply ONLY the client's explicit request. Add NOTHING from our side (no
# forced/default bail, no default stone rules, no invented ornaments). This deliberately drops the heavy
# anti-hallucination clauses of MASTER_INITIAL, which were ADDING things and corrupting faithful copies.
LEAN_IMAGE_MASTER = (
    "You are CraftsmanAI, a precise CAD jewelry render engine. A REFERENCE IMAGE is provided and it is "
    "the SOURCE OF TRUTH (highest priority). Reproduce that EXACT piece faithfully and apply ONLY what "
    "the user explicitly requests. Add NOTHING from your own side: no extra components, no default bail, "
    "no invented stones or ornaments, no style or proportion changes. If the user gave no request, "
    "reproduce the piece EXACTLY as-is. Output ONE clean CAD-style render on a pure solid "
    "white background (#FFFFFF), sharp focus, no scene / props / hands. " + CAD_FINISH_LINE
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
    "sharp focus, no background scene. One image only. " + CAD_FINISH_LINE
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

    if (any(w in p for w in ["bust down", "bustdown", "flooded", "fully iced", "iced out", "ice out", "iced-out",
                            "make it icy", "all iced", "full iced", "full ice", "fully ice", "complete ice",
                            "completely iced", "complete iced", "all over diamond", "all over iced", "full diamond",
                            "all diamond", "fully diamond", "covered in diamond", "covered with diamond"])
            or ("cover" in p and ("diamond" in p or "stone" in p or "ice" in p))
            or ("fully" in p and ("diamond" in p or "iced" in p or "stone" in p))):
        directives.append(
            "FULLY ICED-OUT — cover the ENTIRE piece in dense micro-pavé diamonds on EVERY surface. The letter "
            "FACES (and every panel / layer) must be FULLY PAVED edge-to-edge with diamonds — NOT just a diamond "
            "BORDER or outline around plain-metal letters. For a figure or object pendant this means the WHOLE "
            "thing: the body, clothing, face, hair, hands, shoes AND every accessory or element it holds (e.g. a "
            "golf club / stick / bat / ball / tool), PLUS the bail and any frame. If it is a two-layer / step-up "
            "name, BOTH layers are equally fully iced. Leave NO part as plain bare metal anywhere — metal shows "
            "ONLY as the thin prong walls between touching stones. Do NOT outline only / ice only part and leave the rest plain.")
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
    # Lovable edge-case handlers (parse-request / generate-render verbatim): bail style, metal-only, bail-freeze.
    if re.search(r"puffy\s*heart\s*bail", p):
        directives.append("Bail should be a puffy heart-shaped bail only; do not alter the rest of the piece unless requested.")
    if re.search(r"metal\s+change\s+only|just\s+change\s+the\s+metal|only\s+(the\s+)?metal\b|only\s+(change|update)\s+(the\s+)?(metal|colou?r|tone|finish)", p):
        directives.append("Change ONLY the metal color/tone — preserve every other geometric, structural and stone detail exactly.")
    if re.search(r"don'?t\s+touch\s+the\s+bail|leave\s+the\s+bail|keep\s+the\s+bail", p):
        directives.append("Bail must be preserved exactly — do NOT modify bail geometry, size or style.")

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
        # POSITIVE framing only (no "polished / outline / trim / NOT ..."): naming the unwanted outlined-metal
        # look — even to forbid it — primed the image model to produce it. State only what we DO want.
        return (" FULLY ICED — THE LETTERS ARE MADE OF DIAMONDS: every letter, layer and element is a SOLID BLOCK "
                "of small round diamonds, paved across its ENTIRE top face edge to edge so the whole surface is "
                "covered in stones. The diamonds fill the FULL WIDTH of every stroke — the face of each letter is "
                "ALL diamonds, with metal showing only as the thin prong walls between touching stones. Cover both "
                "tiers and the step ledge the same way; use proportionally smaller stones in tight / curved / corner "
                "areas so it stays gap-free to the edges. Every stone crisp, uniform and well-set.")
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
