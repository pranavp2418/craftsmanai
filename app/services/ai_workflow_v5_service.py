"""
Cross-Agent Iterative Refinement Pipeline (v7 — PRODUCTION FINAL)
======================================================================
Built from 26 real retailer samples with HARD RULES enforced at every level.

HARD RULES (NON-NEGOTIABLE — enforced in code, prompts, and QA):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULE 1: Works with ANY jewelry image + ANY prompt
RULE 2: If user mentions NO changes → produce EXACT COPY of reference
RULE 3: If user mentions specific changes → change ONLY those, freeze everything else
RULE 4: If NO reference image → default metal is GOLD (yellow gold)
RULE 5: If user specifies a different metal → use that metal
RULE 6: Output is ALWAYS CAD-styled (premium, approval-ready, white background)
RULE 7: Output quality must match the document samples (crisp, centered, manufacturable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pipeline:
  Router    → classify task type + detect metal + detect changes
  Agent 1   → analyze_changes_with_vision()   (reference-based only)
  Agent 2   → generate_image()                (type-specific prompt)
  Agent 3   → compare_and_validate()          (strict QA)
  Agent 4   → refine_image()                  (if QA fails)
  Compositor → font grids / multi-view         (TYPE D/E)
"""

from __future__ import annotations

import base64
import io
import json
import logging
import re
import time
import uuid
from enum import Enum
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

from app.services.openai_service import openai_service
from app.services.storage_service import upload_image_to_supabase

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VISION_MODEL = "gpt-4o"
EDIT_MODEL = "gpt-image-2"
DEFAULT_MAX_ITERATIONS = 3
MAX_IMAGE_DIMENSION = 1536
RETRY_ATTEMPTS = 3
RETRY_BASE_DELAY = 2.0

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RULE 4: Default metal is GOLD when not specified
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEFAULT_METAL = "yellow gold"


# =============================================================
# METAL DETECTION (RULE 4 + RULE 5)
# =============================================================

def detect_metal_from_prompt(user_request: str) -> str:
    """Detect what metal the user wants. Default to GOLD if not specified.

    RULE 4: No mention of metal → yellow gold
    RULE 5: User specifies metal → use that metal
    """
    lower = user_request.lower()

    metal_map = [
        # Check specific metals first (order matters)
        (["white gold"], "white gold"),
        (["rose gold", "pink gold"], "rose gold"),
        (["platinum"], "platinum"),
        (["silver", "925", "sterling"], "silver"),
        (["two tone", "2 tone", "two-tone", "2-tone"], "two-tone"),
        # Generic gold checks LAST (so "white gold" doesn't match "gold")
        (["yellow gold"], "yellow gold"),
        (["gold"], "yellow gold"),
    ]

    for keywords, metal in metal_map:
        for kw in keywords:
            if kw in lower:
                return metal

    # RULE 4: Default to gold
    return DEFAULT_METAL


# =============================================================
# CHANGE DETECTION (RULE 2 + RULE 3)
# =============================================================

def detect_if_changes_requested(user_request: str) -> bool:
    """Determine if the user is requesting changes or wants an exact copy.

    RULE 2: No changes mentioned → exact copy
    RULE 3: Changes mentioned → change only those
    """
    lower = user_request.lower()

    # Patterns that indicate "just copy/reproduce this"
    exact_copy_patterns = [
        "exact same", "exactly same", "same design", "same as this",
        "replicate", "reproduce", "copy this", "copy of this",
        "same thing", "make this", "create this",
        "same piece", "identical",
    ]

    # Check if the ONLY instruction is to copy
    has_copy_intent = any(p in lower for p in exact_copy_patterns)

    # Patterns that indicate actual changes
    change_patterns = [
        "change", "modify", "add", "remove", "replace", "swap",
        "make it", "turn it", "convert", "instead", "different",
        "bigger", "smaller", "thicker", "thinner", "wider", "narrower",
        "more", "less", "increase", "decrease", "want",
        "color", "metal", "stone", "diamond", "gold", "silver",
        "font", "bail", "border", "text", "name", "letter",
        "emerald", "baguette", "moissanite", "pave", "iced",
        "bust down", "flood", "honeycomb", "mosaic",
        "rose gold", "white gold", "platinum", "two tone",
        "take off", "put on", "design like", "need",
    ]

    has_change_intent = any(p in lower for p in change_patterns)

    # If user says "exact same" AND mentions changes → changes win
    # If user says "exact same" with NO changes → exact copy
    if has_copy_intent and not has_change_intent:
        return False  # RULE 2: exact copy

    if has_change_intent:
        return True  # RULE 3: changes requested

    # If prompt is very short or vague, treat as exact copy
    if len(user_request.strip()) < 15:
        return False

    return True  # Default: assume user wants something done


def extract_specific_changes(user_request: str) -> List[str]:
    """Extract exactly WHAT the user wants changed.

    Returns a list of specific change instructions.
    Used to enforce RULE 3: change ONLY what user asked.
    """
    changes: list[str] = []
    lower = user_request.lower()

    # Bail changes
    bail_patterns = [
        (r'change\s+(?:the\s+)?(?:bail|beil)\s+to\s+(.+?)(?:\.|$)', "Change bail to: {0}"),
        (r'(?:money\s*bag|butterfly|heart|cookie)\s*(?:bail|beil)', "Change bail to: {match}"),
        (r'make\s+bail\s+(.+?)(?:\.|$)', "Modify bail: {0}"),
    ]
    for pattern, template in bail_patterns:
        match = re.search(pattern, lower)
        if match:
            if "{0}" in template:
                changes.append(template.format(match.group(1).strip()))
            else:
                changes.append(template.format(match=match.group(0).strip()))

    # Stone changes
    if re.search(r'(?:change|swap|replace).+?(?:stone|diamond|emerald|baguette)', lower):
        changes.append(f"Stone modification: {user_request}")
    if re.search(r'add\s+(?:more\s+)?(?:stone|diamond|moissanite)', lower):
        changes.append(f"Add stones: {user_request}")

    # Metal changes
    if re.search(r'(?:change|make|want).+?(?:gold|silver|platinum|rose|white)', lower):
        metal = detect_metal_from_prompt(user_request)
        changes.append(f"Change metal to: {metal}")

    # Text changes
    text_match = re.search(r'(?:change|want|add)\s+(?:text|name|word|letter).+?["""]([^"""]+)["""]', user_request, re.IGNORECASE)
    if text_match:
        changes.append(f"Change text to: {text_match.group(1)}")

    # Removal
    remove_match = re.search(r'(?:remove|take\s+off|delete|no|don\'t\s+want)\s+(?:the\s+)?(.+?)(?:\.|,|$)', lower)
    if remove_match:
        changes.append(f"Remove: {remove_match.group(1).strip()}")

    # If no specific changes extracted but user clearly wants something
    if not changes and detect_if_changes_requested(user_request):
        changes.append(user_request)

    return changes


# =============================================================
# TASK TYPE CLASSIFICATION
# =============================================================

class TaskType(str, Enum):
    EXACT_COPY = "EXACT_COPY"                     # No changes, reproduce reference
    FROM_SCRATCH = "FROM_SCRATCH"                  # No reference image, create from prompt
    REFERENCE_MODIFY = "REFERENCE_MODIFY"          # Modify specific parts of reference
    ITERATIVE_REFINE = "ITERATIVE_REFINE"          # Multi-step refinement
    FONT_OPTIONS_GRID = "FONT_OPTIONS_GRID"        # Multiple font variants
    MULTI_VIEW = "MULTI_VIEW"                      # Multiple angles


def classify_task_type(
    user_request: str,
    has_reference_image: bool,
    has_prior_output: bool = False,
) -> TaskType:
    """Classify task type with RULE 2 (exact copy) as first check."""
    lower = user_request.lower()

    # RULE 2: If reference provided and no changes requested → exact copy
    if has_reference_image and not detect_if_changes_requested(user_request):
        return TaskType.EXACT_COPY

    # Font options
    font_patterns = [
        "show me different fonts", "font options", "multiple fonts",
        "different fonts ideas", "show me options", "fonts options",
        "different fonts with options", "show me multiple fonts",
    ]
    if any(p in lower for p in font_patterns):
        return TaskType.FONT_OPTIONS_GRID

    # Multi-view
    view_patterns = [
        "different angles", "show different angles", "side profile",
        "multiple angles", "show backplate", "show back",
        "rotating", "reversable", "spinning",
    ]
    if any(p in lower for p in view_patterns):
        return TaskType.MULTI_VIEW

    # Iterative refinement
    if has_prior_output:
        return TaskType.ITERATIVE_REFINE

    # From scratch (no reference)
    if not has_reference_image:
        return TaskType.FROM_SCRATCH

    # Default: reference modification
    return TaskType.REFERENCE_MODIFY


# =============================================================
# RETRY DECORATOR
# =============================================================

def _retry(attempts: int = RETRY_ATTEMPTS, base_delay: float = RETRY_BASE_DELAY):
    def decorator(fn: Callable):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            last_exc: Exception | None = None
            for attempt in range(1, attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except Exception as exc:
                    last_exc = exc
                    if attempt < attempts:
                        delay = base_delay * (2 ** (attempt - 1))
                        logger.warning("%s attempt %d/%d: %s — retrying in %.1fs",
                                       fn.__name__, attempt, attempts, exc, delay)
                        time.sleep(delay)
            raise last_exc  # type: ignore
        return wrapper
    return decorator


# =============================================================
# HARD RULES — EMBEDDED IN EVERY PROMPT
# (these blocks are injected into ALL prompt templates)
# =============================================================

HARD_RULES_BLOCK = """
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY RULES (NEVER VIOLATE — these override everything else):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OUTPUT IS ALWAYS CAD-STYLED:
   - Clean, premium, approval-ready jewelry render
   - Crisp edges, studio lighting, manufacturable appearance
   - Clean white or very light neutral background
   - Front-facing hero angle, centered composition
   - No body parts, no hands, no props, no environment
   - No cinematic atmosphere, no dramatic shadows
   - Symmetry-preserving, structurally clear

2. CHANGE ONLY WHAT USER ASKED:
   - If user requests a specific change, apply ONLY that change
   - Everything NOT mentioned must remain IDENTICAL to reference
   - When in doubt, preserve rather than modify
   - Never add decorative elements the user did not request
   - Never remove elements the user did not ask to remove
   - Never change metal, stones, text, or layout unless explicitly asked

3. EXACT COPY WHEN NO CHANGES REQUESTED:
   - If user provides a reference and doesn't specify changes,
     reproduce the reference as faithfully as possible
   - Same silhouette, same proportions, same stones, same metal,
     same text, same bail, same everything

4. NO HALLUCINATION:
   - No invented components, no extra ornaments
   - No melted geometry, no floating stones
   - No impossible prongs, no warped text
   - No broken chain logic, no distorted typography
   - No random asymmetry, no non-manufacturable structures

5. TEXT MUST BE EXACT:
   - Any text, name, initials, or numbers must be spelled correctly
   - Every letter must be clearly readable
   - Font style must match what the user requested or reference shows
   - Never invent or change text content
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""

PRESERVE_LIST_BLOCK = """
AUTO-FREEZE LIST (unless user EXPLICITLY asks to change these):
- Silhouette and overall outline shape
- Proportions and scale relationships
- Metal color and tone
- Stone coverage (which areas have stones, which don't)
- Stone arrangement (rows, pave pattern, density)
- Setting style (prong / bezel / channel / pave / micro-pave)
- Border and frame style
- Bail and clasp geometry
- Font and text construction
- Relief depth hierarchy
- Side profile details
- Negative space and cutouts
- Camera angle (front-facing hero)
- Composition and centering"""

SUPPORTED_TYPES = """
SUPPORTED JEWELRY TYPES:
Rings · Pendants · Chains · Earrings · Bracelets · Grillz · Watches
(with all standard subtypes: Band, Signet, Name/Initial, Cuban, Hoop, Tennis, etc.)"""

STONE_RULES = """
STONE RULES:
- Realistic small-to-mid stones unless user asks for bold/large
- Staggered/honeycomb on paved surfaces, follow surface curvature
- Respect explicit row counts (resize stones to fit)
- Uniform prong/setting style within each region
- No floating stones, no impossible settings"""

ANTI_HALLUCINATION = """
HARD NEGATIVES (NEVER do these):
- Do NOT add elements the user didn't ask for
- Do NOT change subtype of the jewelry
- Do NOT add extra stones, links, layers, or motifs
- Do NOT distort text, logos, or engraving
- Do NOT melt metal edges
- Do NOT create floating stones or impossible prongs
- Do NOT break chain rhythm or clasp logic
- Do NOT produce asymmetry unless requested
- Do NOT create non-manufacturable structures
- Do NOT alter unchanged regions during refinement
- Do NOT creatively reinterpret the piece"""


# =============================================================
# CRAFTSMAN SYSTEM PROMPT
# =============================================================

CRAFTSMAN_SYSTEM = f"""You are CraftsmanAI — a precision jewelry visualization engine.
You are NOT a creative artist. You are a controlled render engine.

{HARD_RULES_BLOCK}

{SUPPORTED_TYPES}

{STONE_RULES}

{ANTI_HALLUCINATION}

PRIORITY ORDER (resolve conflicts in this order):
1. The user's explicit request
2. The reference image (if provided)
3. The subtype defaults
4. The style rules above"""


# =============================================================
# PROMPT TEMPLATES
# =============================================================

# ── EXACT COPY (RULE 2) ──
TEMPLATE_EXACT_COPY = f"""{CRAFTSMAN_SYSTEM}

TASK: EXACT REPRODUCTION
The user wants an exact copy of the attached reference image as a CAD-styled render.
Do NOT change anything. Reproduce every detail faithfully:
- Same shape, same proportions, same silhouette
- Same metal type and color
- Same stones, same arrangement, same coverage
- Same text/lettering if any
- Same bail, same clasp, same border
- Same everything

Design subject: {{user_request}}
Item type: {{jewellery_type}}
Metal tone: {{metal_tone}}

{PRESERVE_LIST_BLOCK}

Generate ONE front-facing hero render. EXACT reproduction. CAD-styled. White background. Centered."""

# ── FROM SCRATCH (no reference, RULE 4: gold default) ──
TEMPLATE_FROM_SCRATCH = f"""{CRAFTSMAN_SYSTEM}

TASK: CREATE FROM SCRATCH
No reference image provided. Create a brand-new jewelry piece from the user's description.

DESIGN SPECIFICATION:
- User request: "{{user_request}}"
- Item type: {{jewellery_type}}
- Metal tone: {{metal_tone}}
- Text content: "{{text_content}}"
- Font style: {{font_style}}
- Layers: {{layer_info}}
- Stone coverage: {{stone_coverage}}
- Bail style: {{bail_style}}

{{directives_block}}

TEXT RENDERING (if text is involved):
- Text must be EXACTLY: "{{text_content}}" — spell every letter correctly
- Letters must be clearly readable, evenly spaced
- If script: letters connect smoothly, no broken joins
- If block: geometrically uniform letters

Generate ONE front-facing hero render. CAD-styled. White background. Centered. Premium quality."""

# ── REFERENCE MODIFY (RULE 3: change only what's asked) ──
TEMPLATE_REFERENCE_MODIFY = f"""{CRAFTSMAN_SYSTEM}

TASK: TARGETED MODIFICATION
The attached image is the MASTER REFERENCE. It is the visual truth.
Apply ONLY the specific changes listed below. FREEZE everything else.

DESIGN CONTEXT:
- Item type: {{jewellery_type}}
- Metal tone: {{metal_tone}}
- User request: "{{user_request}}"

━━━ WHAT TO CHANGE (apply these and ONLY these): ━━━
{{changes_list}}

━━━ WHAT TO FREEZE (do NOT touch ANY of these): ━━━
{{freeze_list}}

{{analysis_block}}
{{directives_block}}

MODIFICATION RULES:
- Reference image is AUTHORITATIVE for everything not listed in changes
- If user says "remove X" → fill vacated area with surrounding material seamlessly
- If user says "change text to X" → use same font, size, style as original
- If user says "change stones to X" → swap only the stone type, preserve arrangement
- If user says "change bail to X" → change ONLY the bail, freeze pendant body
- If user says "change metal to X" → change ONLY the metal tone, freeze everything else

{PRESERVE_LIST_BLOCK}

Generate ONE front-facing hero render. CAD-styled. White background. Centered."""

# ── ITERATIVE REFINE (change only new request, preserve all prior work) ──
TEMPLATE_ITERATIVE_REFINE = f"""{CRAFTSMAN_SYSTEM}

TASK: ITERATIVE REFINEMENT (Iteration {{iteration_number}})
The attached image is the CURRENT STATE after all prior modifications.
Apply ONLY the new change below. Everything else stays IDENTICAL.

CONTEXT:
- Item type: {{jewellery_type}}
- Metal tone: {{metal_tone}}
- Prior changes already applied: {{prior_changes}}

━━━ NEW CHANGE TO APPLY NOW: ━━━
{{current_change}}

━━━ EVERYTHING ELSE: FREEZE EXACTLY AS-IS ━━━

{{qa_feedback_block}}
{{analysis_block}}
{{directives_block}}

TARGET REGIONS: {{target_regions}}
ALL OTHER REGIONS: FROZEN — do not touch

RULES:
- This is a REFINEMENT, not a redesign
- The attached image is the ONLY visual truth
- Change LESS rather than more — if unsure, keep it
- Address any QA feedback issues listed above
- Preserve silhouette, proportions, metal, stones, text, layout, angle

{PRESERVE_LIST_BLOCK}

Generate ONE front-facing hero render preserving current state with ONLY the new change."""

# ── FONT VARIANT (single variant for grid) ──
TEMPLATE_FONT_VARIANT = f"""{CRAFTSMAN_SYSTEM}

TASK: FONT VARIANT RENDER
Generate ONE jewelry render with a SPECIFIC font style.

TEXT TO RENDER: "{{text_content}}"
FONT STYLE: {{font_instruction}}

SPEC:
- Item type: {{jewellery_type}}
- Metal tone: {{metal_tone}}
- Layers: 2-layer (raised letters on background plate)
- Top layer: full stone coverage, {{stone_setting}} setting
- Bottom layer: full stone coverage
- Bail: standard rectangular bail with stones
- Sides: stones on visible edges

TEXT RULES:
- Text is EXACTLY: "{{text_content}}" — every letter correct
- Use the described font style — do NOT default to a generic font
- Letters must be clearly readable and evenly spaced

Generate ONE front-facing hero render. CAD-styled. White background. Centered.
Do NOT include labels or annotations."""


# =============================================================
# FONT STYLE MATRIX (for TYPE D)
# =============================================================

FONT_STYLE_MATRIX = [
    {"id": "block_caps", "label": "ALL CAPS (BLOCK)", "instruction": "Bold block letters, all uppercase, strong geometric shapes, thick uniform strokes"},
    {"id": "rounded_caps", "label": "ALL CAPS (ROUNDED)", "instruction": "Rounded bubble-style block letters, all uppercase, soft edges, uniform width"},
    {"id": "classic_serif", "label": "ALL CAPS (CLASSIC SERIF)", "instruction": "Classic serif font, all uppercase, traditional proportions with serifs"},
    {"id": "modern_sans", "label": "ALL CAPS (MODERN SANS)", "instruction": "Modern sans-serif font, all uppercase, clean geometric letterforms"},
    {"id": "script_caps", "label": "ALL CAPS (SCRIPT)", "instruction": "Script/cursive style but all capitals, flowing connected strokes"},
    {"id": "brush_caps", "label": "ALL CAPS (BRUSH)", "instruction": "Brush-stroke style letters, all uppercase, organic thick strokes"},
    {"id": "script_mixed", "label": "CAPS & SMALL (SCRIPT 1)", "instruction": "Elegant script cursive, capital first letter, lowercase rest, flowing connected"},
    {"id": "script_mixed_2", "label": "CAPS & SMALL (SCRIPT 2)", "instruction": "Decorative script cursive, capital first letter with flourish, lowercase rest, slanted italic"},
    {"id": "serif_mixed", "label": "CAPS & SMALL (SERIF)", "instruction": "Classic serif, capital first letter, lowercase rest, traditional book-style"},
    {"id": "modern_mixed", "label": "CAPS & SMALL (MODERN)", "instruction": "Clean modern font, capital first letter, lowercase rest, minimalist geometric"},
    {"id": "old_english", "label": "OLD ENGLISH (GOTHIC)", "instruction": "Old English / Gothic blackletter, ornate angular strokes, medieval style"},
    {"id": "graffiti", "label": "GRAFFITI / STREET", "instruction": "Graffiti-inspired lettering, dynamic angles, urban street art feel"},
]


# =============================================================
# RETAILER LANGUAGE NORMALIZER (47 patterns from 26 samples)
# =============================================================

def normalize_retailer_language(note: str) -> List[str]:
    """Convert retailer slang into precise technical instructions."""
    lower = note.lower()
    directives: list[str] = []

    # ── Dimensions ──
    row_match = re.search(r'\b(\d+)\s*rows?\b', lower)
    if row_match:
        directives.append(f"Stone row count: {row_match.group(1)} rows. Resize stones to fit.")

    dim_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:"|inches?)\s*(?:tall|long|wide|in\s+(?:length|height|width))?', lower)
    if dim_match:
        directives.append(f"Target dimension: ~{dim_match.group(1)} inches.")

    watch_match = re.search(r'(\d+)\s*mm\b', lower)
    if watch_match:
        directives.append(f"Watch head: {watch_match.group(1)}mm diameter.")

    ring_match = re.search(r'(?:finger\s+)?size\s+(\d+(?:\.\d+)?)', lower)
    if ring_match:
        directives.append(f"Ring size: {ring_match.group(1)}.")

    prong_match = re.search(r'(\d+)\s*prong', lower)
    if prong_match:
        directives.append(f"{prong_match.group(1)}-prong setting for center stone.")

    carat_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:ct|carat)', lower)
    if carat_match:
        directives.append(f"Center stone: {carat_match.group(1)} carat.")

    coverage_match = re.search(r'(\d+)%\s*(?:diamond|stone)?\s*coverage', lower)
    if coverage_match:
        directives.append(f"Diamond coverage: {coverage_match.group(1)}%.")

    # ── Keyword → directive mapping ──
    _kw_map: list[tuple[list[str], str]] = [
        # Stone types and cuts
        (["emerald cut"], "Emerald-cut: rectangular step-cut stones."),
        (["baguette"], "Baguette-cut: narrow rectangular stones."),
        (["round diamond", "round stone"], "Round brilliant-cut stones."),
        (["mosonite", "moissanite"], "Moissanite stones."),
        (["green emerald", "emerald stone"], "Green emerald gemstones (rich green)."),

        # Settings
        (["mosaic setting"], "Mosaic setting: irregular stones fitted like tiles."),
        (["honeycomb setting", "honeycomb"], "Honeycomb setting: hexagonal stone arrangement."),
        (["channel setting"], "Channel setting: stones between parallel metal walls."),
        (["micro pave", "micro-pave"], "Micro-pavé setting: very small stones, minimal metal visible."),
        (["pave", "pavé"], "Pavé setting: small stones close together."),

        # Coverage
        (["smaller stones", "finer diamonds"], "Use smaller stones for higher density."),
        (["tighter setting", "no gaps", "more dense"], "Tighter stone spacing, minimal visible metal."),
        (["flooded", "bust down", "fully iced", "full ice"], "Maximum stone coverage, clean arrangement."),
        (["border only"], "Stones on border/frame region only."),
        (["top only"], "Stones on top/face region only."),
        (["plain shank"], "Shank/band plain, no stones."),

        # Bail types
        (["money bag", "moneybag"], "Bail: money-bag shape with $ symbol and gathered top."),
        (["butterfly bail", "butterfly shape bail"], "Bail: butterfly with diamond-covered wings."),
        (["heart bail", "heart as a bail"], "Bail: heart shape, chain passes through."),
        (["cookie bail", "cookie emoji", "chocolate cookie"], "Bail: chocolate chip cookie with colored stone chips."),
        (["make bail with hinges", "hinged bail"], "Bail: hinged/articulated connection."),

        # Metal
        (["2 tone", "two tone", "two-tone"], "Two-tone metal design."),
        (["rose gold"], "Rose gold metal (warm pink-gold)."),
        (["white gold"], "White gold metal (bright silvery-white)."),
        (["platinum"], "Platinum metal."),
        (["silver", "sterling"], "Silver / sterling silver metal."),

        # Surface
        (["nugget", "nuggets"], "Nugget-style: organic irregular gold texture."),
        (["enamel"], "Enamel: glass-like opaque color coating."),
        (["barb wire", "barbwire"], "Barb wire: twisted wire with pointed barbs."),
        (["diamond cut edge", "diamond-cut"], "Diamond-cut edge: faceted carved metal, NOT stone border."),

        # Preservation
        (["same font", "same style"], "Preserve exact original font/style."),
        (["same as ref", "same as reference", "exact same"], "Preserve all unspecified details from reference."),

        # Structural
        (["3d letters", "raised letters", "popped letters"], "Letters as raised 3D geometry with depth and side walls."),
        (["more 3d", "more depth"], "Increase relief depth, keep silhouette."),
        (["emboss", "embossed"], "Embossed: raised relief on metal surface."),
        (["show backplate solid"], "Solid (not openwork) back plate."),
    ]

    for keywords, directive in _kw_map:
        for kw in keywords:
            if kw in lower:
                directives.append(directive)
                break

    # ── Regex-based ──
    _regex_map: list[tuple[str, str]] = [
        (r"don't touch the bail|leave the bail", "DO NOT modify bail."),
        (r'side\s+engraving|engraving\s+on\s+the\s+side', "Modify ONLY side engraving zone."),
        (r'metal\s+change\s+only|just\s+change\s+the\s+metal|only\s+(the\s+)?metal', "Change ONLY metal tone."),
        (r'keep\s+everything\s+(else\s+)?same|keep\s+(the\s+)?rest\s+same', "Reference is authoritative for all non-mentioned regions."),
        (r'champagne\s+(?:color|dial)', "Champagne color: warm golden/honey tone."),
        (r'take\s+off|remove.*?crown', "Remove crown element."),
        (r'no\s+birds?|remove\s+(?:the\s+)?birds?', "Remove all bird elements, fill area seamlessly."),
        (r'remove\s+(?:the\s+)?bats?', "Remove specified bat elements."),
        (r'only\s+(?:keep|want)\s+(?:the\s+)?(.+?)(?:\.|,|$)', "Keep ONLY the specified element, remove everything else."),
    ]

    for pattern, directive in _regex_map:
        if re.search(pattern, lower):
            directives.append(directive)

    return directives


# =============================================================
# TARGET REGION IDENTIFICATION
# =============================================================

def identify_target_regions(note: str) -> List[str]:
    lower = note.lower()
    regions: list[str] = []

    region_map = {
        "top_face": ["top face"],
        "center_top": ["center top", "top", "center", "head"],
        "text_logo": ["text", "logo", "letter", "name", "word", "font", "initial"],
        "side_engraving": ["side engraving", "side detail", "side profile"],
        "border_frame": ["border", "frame", "outline", "edge", "thorns", "barb wire"],
        "background_plate": ["background", "back plate", "backplate"],
        "bail": ["bail", "beil", "money bag", "butterfly bail", "heart bail", "cookie"],
        "clasp": ["clasp", "lock", "closure"],
        "shank_band": ["shank", "band", "ring band"],
        "center_stone": ["center stone", "main stone", "solitaire"],
        "halo": ["halo"],
        "side_stones": ["side stone", "accent stone"],
        "link_surface": ["link", "cuban", "chain link", "clover", "infinity"],
        "dial": ["dial", "watch dial", "watch face", "champagne"],
        "bezel": ["bezel"],
        "watch_case": ["case", "casing", "nugget"],
        "hinges": ["hinge", "hinges"],
        "heart": ["heart", "spinning", "rotating"],
        "crown": ["crown"],
        "shoes": ["shoe", "nike", "sneaker"],
        "enamel": ["enamel"],
        "stones_all": ["all stones", "all green", "all white", "change all"],
    }

    for region, kws in region_map.items():
        for kw in kws:
            if kw in lower:
                regions.append(region)
                break

    if not regions:
        for p in ["white gold", "rose gold", "yellow gold", "platinum", "silver",
                   "iced", "diamond", "matte", "polished", "bust down", "flood", "2 tone"]:
            if p in lower:
                regions.append("global_cosmetic")
                break

    return regions or ["unspecified"]


# =============================================================
# TEXT EXTRACTION
# =============================================================

def extract_text_content(user_request: str) -> str:
    # Quoted text
    quoted = re.findall(r'["""\u201c\u201d]([^"""\u201c\u201d]+)["""\u201c\u201d]', user_request)
    if quoted:
        return quoted[0].strip()
    # Pattern-based
    for p in [r'(?:name|word|text|say)\s+(\w[\w\s\.]+?)(?:\s+\d|[,\.]|\s+in\s+|\s+with\s+|$)']:
        m = re.search(p, user_request, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


# =============================================================
# IMAGE HELPERS
# =============================================================

def _load_image_bytes(source: str) -> bytes:
    return openai_service._load_image_bytes_from_source(source)

def _encode_base64(image_bytes: bytes) -> str:
    return openai_service._encode_image_to_base64(image_bytes)

def _extract_openai_image(data_item: Any) -> bytes:
    if hasattr(data_item, "b64_json") and data_item.b64_json:
        return base64.b64decode(data_item.b64_json)
    if isinstance(data_item, dict) and data_item.get("b64_json"):
        return base64.b64decode(data_item["b64_json"])
    url = getattr(data_item, "url", None) or (data_item.get("url") if isinstance(data_item, dict) else None)
    if url:
        import requests as _req
        resp = _req.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    raise ValueError("No image data in API response.")

def _prepare_image_for_edit(image_bytes: bytes) -> io.BytesIO:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.LANCZOS)
    side = max(img.size)
    canvas = Image.new("RGBA", (side, side), (255, 255, 255, 255))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    buf.seek(0)
    return buf

@_retry()
def _generate_image_edit(image_bytes: bytes, prompt: str) -> bytes:
    buf = _prepare_image_for_edit(image_bytes)
    result = openai_service.client.images.edit(
        model=EDIT_MODEL,
        image=("image.png", buf, "image/png"),
        prompt=prompt,
        n=1,
        size="1024x1024",
    )
    return _extract_openai_image(result.data[0])

@_retry()
def _generate_image_from_scratch(prompt: str) -> bytes:
    result = openai_service.client.images.generate(
        model=EDIT_MODEL,
        prompt=prompt,
        n=1,
        size="1024x1024",
    )
    return _extract_openai_image(result.data[0])


# =============================================================
# PROMPT BLOCK FORMATTERS
# =============================================================

def _format_analysis_block(analysis: dict | None) -> str:
    if not analysis:
        return ""
    lines = ["\n=== VISION ANALYSIS ==="]
    for key in ("metal_type", "stone_type", "stone_setting", "stone_coverage",
                "border_style", "detected_subtype", "design_style",
                "text_content", "bail_style"):
        val = analysis.get(key)
        if val and val != "unknown":
            lines.append(f"  {key.replace('_', ' ').title()}: {val}")
    for field, label in [("changes_needed", "Changes"), ("must_preserve", "Preserve")]:
        items = analysis.get(field, [])
        if items:
            lines.append(f"  {label}:")
            for i in items:
                lines.append(f"    - {i}")
    lines.append("=== END ===")
    return "\n".join(lines)


def _format_qa_block(validation: dict | None, prior: list[dict] | None = None) -> str:
    if not validation:
        return ""
    lines = ["\n=== QA FEEDBACK — FIX THESE ISSUES ==="]
    n = validation.get("refinement_notes", "")
    if n:
        lines.append(f"  Inspector: {n}")
    for m in validation.get("missing_changes", []):
        lines.append(f"  MISSING: {m}")
    fix = validation.get("suggested_fix", "")
    if fix:
        lines.append(f"  FIX: {fix}")
    if prior:
        for idx, pv in enumerate(prior, 1):
            pn = pv.get("refinement_notes", "")
            if pn:
                lines.append(f"  Round {idx}: {pn}")
    lines.append("=== END QA ===")
    return "\n".join(lines)


def _format_directives_block(directives: list[str]) -> str:
    if not directives:
        return ""
    lines = ["\nTECHNICAL DIRECTIVES:"]
    for d in directives:
        lines.append(f"  - {d}")
    return "\n".join(lines)


# =============================================================
# PROMPT BUILDERS
# =============================================================

def build_prompt_exact_copy(
    user_request: str, metal_tone: str, jewellery_type: str,
) -> str:
    return TEMPLATE_EXACT_COPY.format(
        user_request=user_request or "reproduce this jewelry piece exactly",
        jewellery_type=jewellery_type,
        metal_tone=metal_tone,
    )


def build_prompt_from_scratch(
    user_request: str, metal_tone: str, jewellery_type: str,
) -> str:
    text_content = extract_text_content(user_request) or user_request
    directives = normalize_retailer_language(user_request)
    lower = user_request.lower()

    font_style = "bold block letters, all uppercase"
    if "script" in lower:
        font_style = "script cursive, connected flowing letters"
    if "old english" in lower or "gothic" in lower:
        font_style = "Old English gothic blackletter"

    layer_info = "2-layer (raised letters + background plate)" if "2 layer" in lower or "two layer" in lower else "standard"
    stone_coverage = "full diamond coverage" if "diamond" in lower or "stone" in lower or "iced" in lower else "as appropriate"

    bail_style = "standard rectangular bail with stones"
    for kw, desc in [("money bag", "money bag bail"), ("butterfly", "butterfly bail"),
                      ("heart bail", "heart bail"), ("cookie", "cookie bail")]:
        if kw in lower:
            bail_style = desc

    return TEMPLATE_FROM_SCRATCH.format(
        user_request=user_request,
        jewellery_type=jewellery_type,
        metal_tone=metal_tone,
        text_content=text_content,
        font_style=font_style,
        layer_info=layer_info,
        stone_coverage=stone_coverage,
        bail_style=bail_style,
        directives_block=_format_directives_block(directives),
    )


def build_prompt_reference_modify(
    user_request: str, metal_tone: str, jewellery_type: str,
    analysis: dict | None = None,
) -> str:
    directives = normalize_retailer_language(user_request)
    specific_changes = extract_specific_changes(user_request)

    changes_list = "\n".join([f"- {c}" for c in specific_changes]) if specific_changes else f"- {user_request}"

    freeze_items = []
    if analysis:
        for p in analysis.get("must_preserve", []):
            freeze_items.append(f"- {p}")
    if not freeze_items:
        freeze_items = [
            "- Overall silhouette and outline",
            "- Proportions and scale",
            "- All non-mentioned regions",
            "- Metal type (unless user asked to change it)",
            "- Stone arrangement (unless user asked to change it)",
            "- Text/lettering (unless user asked to change it)",
            "- Camera angle and composition",
        ]

    return TEMPLATE_REFERENCE_MODIFY.format(
        jewellery_type=jewellery_type,
        metal_tone=metal_tone,
        user_request=user_request,
        changes_list=changes_list,
        freeze_list="\n".join(freeze_items),
        analysis_block=_format_analysis_block(analysis),
        directives_block=_format_directives_block(directives),
    )


def build_prompt_iterative_refine(
    user_request: str, metal_tone: str, jewellery_type: str,
    iteration_number: int = 1,
    prior_changes: list[str] | None = None,
    analysis: dict | None = None,
    validation: dict | None = None,
    prior_validations: list[dict] | None = None,
) -> str:
    directives = normalize_retailer_language(user_request)
    target_regions = identify_target_regions(user_request)

    current_change = "\n".join([f"- {d}" for d in directives]) if directives else f"- {user_request}"
    if validation and validation.get("suggested_fix"):
        current_change += f"\n- ALSO FIX: {validation['suggested_fix']}"

    prior_text = "None"
    if prior_changes:
        prior_text = " → ".join(prior_changes)

    return TEMPLATE_ITERATIVE_REFINE.format(
        iteration_number=iteration_number,
        jewellery_type=jewellery_type,
        metal_tone=metal_tone,
        prior_changes=prior_text,
        current_change=current_change,
        qa_feedback_block=_format_qa_block(validation, prior_validations),
        analysis_block=_format_analysis_block(analysis),
        directives_block=_format_directives_block(directives),
        target_regions=", ".join(target_regions),
    )


def build_prompt_font_variant(
    text_content: str, font_style: dict,
    metal_tone: str, jewellery_type: str, stone_setting: str = "pave",
) -> str:
    return TEMPLATE_FONT_VARIANT.format(
        text_content=text_content,
        font_instruction=font_style["instruction"],
        jewellery_type=jewellery_type,
        metal_tone=metal_tone,
        stone_setting=stone_setting,
    )


# =============================================================
# FONT GRID COMPOSITOR
# =============================================================

def composite_font_grid(
    images: list[bytes], labels: list[str], title: str = "", cols: int = 2,
) -> bytes:
    if not images:
        raise ValueError("No images to composite")

    pil_images = [Image.open(io.BytesIO(b)).convert("RGBA") for b in images]
    cell_size, padding, label_h = 400, 20, 30
    rows = (len(pil_images) + cols - 1) // cols
    grid_w = cols * (cell_size + padding) + padding
    grid_h = rows * (cell_size + label_h + padding) + padding + (60 if title else 0)

    canvas = Image.new("RGBA", (grid_w, grid_h), (255, 255, 255, 255))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        tfont = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    except (IOError, OSError):
        font = tfont = ImageFont.load_default()

    draw = ImageDraw.Draw(canvas)
    y_off = padding
    if title:
        bb = draw.textbbox((0, 0), title, font=tfont)
        draw.text(((grid_w - bb[2] + bb[0]) // 2, y_off), title, fill=(0, 0, 0, 255), font=tfont)
        y_off += 60

    for idx, (img, lbl) in enumerate(zip(pil_images, labels)):
        r, c = idx // cols, idx % cols
        x = padding + c * (cell_size + padding)
        y = y_off + r * (cell_size + label_h + padding)
        img.thumbnail((cell_size, cell_size), Image.LANCZOS)
        canvas.paste(img, (x + (cell_size - img.width) // 2, y + (cell_size - img.height) // 2), img)
        bb = draw.textbbox((0, 0), lbl, font=font)
        draw.text((x + (cell_size - bb[2] + bb[0]) // 2, y + cell_size + 5), lbl, fill=(80, 80, 80, 255), font=font)

    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    return buf.getvalue()


# =============================================================
# AGENTS
# =============================================================

@_retry()
def analyze_changes_with_vision(base_image_source: str, user_request: str) -> dict:
    """Agent 1 – Vision analysis of reference + user intent."""
    logger.info("🔍 Agent 1: Analyzing...")

    b64 = _encode_base64(_load_image_bytes(base_image_source))

    messages = [
        {"role": "system", "content": """Analyze this jewelry image + user request. Return JSON ONLY:
{
  "changes_needed": ["list"],
  "must_preserve": ["list"],
  "target_components": ["bail", "border", etc.],
  "target_regions": ["center_text_logo", etc.],
  "change_type": "modification | exact_copy | addition | removal | material_swap",
  "render_strategy": "exact_copy | local_edit | partial_regen | full_regen",
  "metal_type": "detected metal",
  "stone_type": "detected stone type",
  "stone_setting": "pave | prong | channel | bezel | mosaic",
  "stone_coverage": "none | sparse | moderate | heavy | fully_iced",
  "detected_subtype": "subtype",
  "text_content": "any text visible on piece",
  "bail_style": "current bail description",
  "design_style": "overall aesthetic"
}
No markdown fences. JSON only."""},
        {"role": "user", "content": [
            {"type": "text", "text": f'Prompt: """{user_request}"""'},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]},
    ]

    resp = openai_service.client.chat.completions.create(
        model=VISION_MODEL, messages=messages, max_tokens=1000, temperature=0.15,
    )
    text = resp.choices[0].message.content.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        s, e = text.find("{"), text.rfind("}") + 1
        if s != -1 and e > 0:
            return json.loads(text[s:e])
    except json.JSONDecodeError:
        pass
    return {"changes_needed": [user_request], "must_preserve": ["everything not mentioned"],
            "target_components": ["pendant"], "change_type": "modification",
            "metal_type": "unknown", "stone_type": "unknown", "design_style": "jewelry"}


@_retry()
def compare_and_validate(
    base_image_source: str, generated_bytes: bytes,
    analysis: dict, user_request: str = "",
) -> dict:
    """Agent 3 – QA validation."""
    logger.info("🔍 Agent 3: Validating...")

    b64_base = _encode_base64(_load_image_bytes(base_image_source))
    b64_gen = _encode_base64(generated_bytes)
    changes = user_request or ", ".join(analysis.get("changes_needed", []))

    messages = [
        {"role": "system", "content": f"""Strict jewelry QA inspector. Compare REFERENCE (img 1) vs GENERATED (img 2).

RULES TO CHECK:
1. If user asked for CHANGES: are they VISIBLY and CORRECTLY applied?
2. Are NON-TARGET regions IDENTICAL to reference? (CRITICAL — any unwanted change is a FAIL)
3. No hallucinated/added elements?
4. Text accuracy: all letters correct and readable?
5. CAD-quality render: centered, white background, crisp, premium?
6. No structural defects: melted geometry, floating stones, etc.?

JSON ONLY:
{{"passed": true/false, "score": 0-100, "reason": "summary",
  "failed_checks": ["specific failures"], "preserved_correctly": ["what was kept"],
  "retry_recommended": true/false, "suggested_fix": "fix instruction",
  "text_accuracy": "correct | misspelled | missing | distorted",
  "unwanted_changes": ["regions that changed but shouldn't have"]}}"""},
        {"role": "user", "content": [
            {"type": "text", "text": f'Request: "{changes}"\nCompare reference (1) vs generated (2).'},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_base}"}},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64_gen}"}},
        ]},
    ]

    resp = openai_service.client.chat.completions.create(
        model=VISION_MODEL, messages=messages, max_tokens=600, temperature=0.15,
    )
    text = resp.choices[0].message.content.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        s, e = text.find("{"), text.rfind("}") + 1
        if s != -1 and e > 0:
            qa = json.loads(text[s:e])
            passed = qa.get("passed", False)
            return {
                "changes_implemented": qa.get("preserved_correctly", []) if passed else [],
                "missing_changes": qa.get("failed_checks", []),
                "quality_issues": qa.get("unwanted_changes", []) + ([] if passed else qa.get("failed_checks", [])),
                "needs_refinement": not passed,
                "refinement_notes": qa.get("reason", ""),
                "suggested_fix": qa.get("suggested_fix", ""),
                "score": qa.get("score", 0),
                "text_accuracy": qa.get("text_accuracy", "unknown"),
            }
    except json.JSONDecodeError:
        pass

    needs_fix = any(kw in text.lower() for kw in ("fail", "missing", "incorrect", "not applied"))
    return {"needs_refinement": needs_fix, "refinement_notes": text,
            "missing_changes": ["check_manually"], "suggested_fix": "", "score": 50}


# =============================================================
# MAIN PIPELINE ORCHESTRATOR
# =============================================================

def generate_jewelry_with_cross_agent(
    base_image_source: str | None,
    user_request: str,
    *,
    metal_tone: str | None = None,  # None = auto-detect (RULE 4: defaults to gold)
    jewellery_type: str = "pendant",
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
    progress_callback: Callable | None = None,
    prior_changes: list[str] | None = None,
) -> Tuple[list[bytes] | None, list[dict]]:
    """
    Production jewelry generation pipeline.

    HARD RULES ENFORCED:
    - RULE 1: Works with any image + any prompt
    - RULE 2: No changes → exact copy
    - RULE 3: Changes → change only what's asked
    - RULE 4: No reference + no metal specified → gold
    - RULE 5: User specifies metal → use that metal
    - RULE 6: Output is ALWAYS CAD-styled
    - RULE 7: Production quality output
    """
    logger.info("━━━ Pipeline start ━━━")
    logger.info("Request: %s", user_request)

    all_images: list[bytes] = []
    all_validations: list[dict] = []

    def _progress(stage: str, msg: str = "", **extra):
        if progress_callback:
            progress_callback(stage, {"message": msg, **extra})

    # ── RULE 4 + RULE 5: Metal detection ──
    if metal_tone is None:
        metal_tone = detect_metal_from_prompt(user_request)
    logger.info("Metal: %s (auto-detected)" if metal_tone == DEFAULT_METAL else "Metal: %s (user-specified)", metal_tone)

    # ── Classify task type ──
    has_ref = base_image_source is not None
    task_type = classify_task_type(user_request, has_ref, bool(prior_changes))
    logger.info("Task type: %s", task_type.value)
    _progress("classifying", f"Task: {task_type.value}, Metal: {metal_tone}")

    # ━━━ RULE 2: EXACT COPY ━━━
    if task_type == TaskType.EXACT_COPY:
        _progress("generating", "Producing exact CAD-styled copy...")
        prompt = build_prompt_exact_copy(user_request, metal_tone, jewellery_type)
        try:
            base_bytes = _load_image_bytes(base_image_source)
            img = _generate_image_edit(base_bytes, prompt)
            all_images.append(img)
            _progress("complete", "Exact copy generated", total_images=1)
            return all_images, all_validations
        except Exception as e:
            logger.error("Exact copy failed: %s", e)
            _progress("failed", str(e))
            return None, all_validations

    # ━━━ TYPE D: Font options grid ━━━
    if task_type == TaskType.FONT_OPTIONS_GRID:
        return _handle_font_grid(user_request, metal_tone, jewellery_type, base_image_source, _progress)

    # ━━━ FROM SCRATCH (no reference, RULE 4: gold) ━━━
    if task_type == TaskType.FROM_SCRATCH:
        _progress("generating", "Creating from scratch...")
        prompt = build_prompt_from_scratch(user_request, metal_tone, jewellery_type)
        try:
            img = _generate_image_from_scratch(prompt)
            all_images.append(img)
            _progress("complete", "Design created", total_images=1)
            return all_images, all_validations
        except Exception as e:
            logger.error("From-scratch failed: %s", e)
            _progress("failed", str(e))
            return None, all_validations

    # ━━━ All remaining types need a reference ━━━
    if not base_image_source:
        _progress("failed", "Reference image required")
        return None, all_validations

    # ── Agent 1: Analyze ──
    _progress("analyzing", "Analyzing reference...")
    analysis = analyze_changes_with_vision(base_image_source, user_request)

    # ── RULE 5: Use analysis-detected metal if user didn't specify ──
    if metal_tone == DEFAULT_METAL and analysis.get("metal_type") not in (None, "unknown", ""):
        detected = analysis["metal_type"].lower()
        if "white" in detected:
            metal_tone = "white gold"
        elif "rose" in detected or "pink" in detected:
            metal_tone = "rose gold"
        elif "silver" in detected or "sterling" in detected:
            metal_tone = "silver"
        elif "platinum" in detected:
            metal_tone = "platinum"
        # else keep gold default

    # ── Agent 2: Generate ──
    _progress("generating", "Generating design...")
    if task_type == TaskType.ITERATIVE_REFINE:
        prompt = build_prompt_iterative_refine(
            user_request, metal_tone, jewellery_type,
            iteration_number=1, prior_changes=prior_changes, analysis=analysis,
        )
    else:
        prompt = build_prompt_reference_modify(
            user_request, metal_tone, jewellery_type, analysis,
        )

    try:
        base_bytes = _load_image_bytes(base_image_source)
        current_image = _generate_image_edit(base_bytes, prompt)
    except Exception as e:
        logger.error("Generation failed: %s", e)
        _progress("failed", str(e))
        return None, all_validations

    all_images.append(current_image)

    # ── Iterative QA + refinement loop ──
    for iteration in range(max_iterations):
        logger.info("🔄 Iteration %d/%d", iteration + 1, max_iterations)

        _progress("validating", f"QA check {iteration + 1}...", iteration=iteration)
        validation = compare_and_validate(
            base_image_source, current_image, analysis, user_request,
        )
        all_validations.append(validation)

        if not validation.get("needs_refinement", True):
            logger.info("✅ QA passed (score=%s)", validation.get("score"))
            _progress("complete", "QA passed!", iteration=iteration)
            break

        if iteration < max_iterations - 1:
            _progress("refining", f"Refining {iteration + 1}...", iteration=iteration)
            refine_prompt = build_prompt_iterative_refine(
                user_request, metal_tone, jewellery_type,
                iteration_number=iteration + 2,
                prior_changes=(prior_changes or []) + [user_request],
                analysis=analysis,
                validation=validation,
                prior_validations=all_validations[:-1],
            )
            try:
                refined = _generate_image_edit(current_image, refine_prompt)
                current_image = refined
                all_images.append(current_image)
            except Exception as e:
                logger.warning("Refinement failed: %s", e)
                break

    _progress("complete", f"Done — {len(all_images)} images", total_images=len(all_images))
    logger.info("━━━ Pipeline complete: %d images ━━━", len(all_images))
    return all_images, all_validations


def _handle_font_grid(
    user_request: str, metal_tone: str, jewellery_type: str,
    base_image_source: str | None, progress: Callable,
) -> Tuple[list[bytes] | None, list[dict]]:
    """Generate multiple font variants and composite into grid."""
    text_content = extract_text_content(user_request) or user_request
    lower = user_request.lower()

    wants_caps = "all caps" in lower
    wants_mixed = "caps and small" in lower
    if wants_caps and wants_mixed:
        styles = FONT_STYLE_MATRIX[:10]
    elif wants_caps:
        styles = [s for s in FONT_STYLE_MATRIX if "ALL CAPS" in s["label"]][:6]
    elif wants_mixed:
        styles = [s for s in FONT_STYLE_MATRIX if "CAPS & SMALL" in s["label"]][:6]
    else:
        styles = FONT_STYLE_MATRIX[:6]

    stone_setting = "pave"
    if "baguette" in lower: stone_setting = "baguette"
    elif "mosaic" in lower: stone_setting = "mosaic"

    progress("generating", f"Generating {len(styles)} font variants...")
    imgs: list[bytes] = []
    lbls: list[str] = []

    for idx, style in enumerate(styles):
        progress("generating", f"Font {idx + 1}/{len(styles)}: {style['label']}...")
        prompt = build_prompt_font_variant(text_content, style, metal_tone, jewellery_type, stone_setting)
        try:
            if base_image_source:
                img = _generate_image_edit(_load_image_bytes(base_image_source), prompt)
            else:
                img = _generate_image_from_scratch(prompt)
            imgs.append(img)
            lbls.append(f"Option {idx + 1} – {style['label']}")
        except Exception as e:
            logger.warning("Font %s failed: %s", style["label"], e)

    if not imgs:
        progress("failed", "All font variants failed")
        return None, []

    progress("generating", "Building grid...")
    grid = composite_font_grid(imgs, lbls, title=f"{text_content.upper()} — FONT OPTIONS")
    progress("complete", f"{len(imgs)} font options", total_images=len(imgs) + 1)
    return [grid] + imgs, []


# =============================================================
# CONVENIENCE
# =============================================================

def upload_final_image(
    image_bytes: bytes, design_id: int | str, variant_id: int | str | None = None,
) -> str:
    suffix = f"v{variant_id}" if variant_id else "initial"
    return upload_image_to_supabase(image_bytes, f"generated/base/{design_id}/{suffix}")



# """
# Cross-Agent Iterative Refinement Pipeline (v5)
# ======================================================================
# Integrates with the existing OpenAIService singleton for all API calls,
# and uses Supabase storage instead of local filesystem saving.

# Pipeline (from codeflow_pipeline.py / codeflow.docx):
#   Agent 1 → analyze_changes_with_vision()
#   Agent 2 → generate_initial_image()
#   Agent 3 → compare_and_validate()
#   Agent 4 → refine_image()

# All prompts and pipeline logic are ported from codeflow_pipeline.py.
# """

# from __future__ import annotations

# import base64
# import io
# import json
# import logging
# import re
# import uuid
# from typing import Any, List, Optional

# from PIL import Image

# from app.services.openai_service import openai_service
# from app.services.storage_service import upload_image_to_supabase

# logger = logging.getLogger(__name__)

# # ---------------------------------------------------------------------------
# # Constants
# # ---------------------------------------------------------------------------
# VISION_MODEL = "gpt-4o"
# EDIT_MODEL = "gpt-image-2"
# DEFAULT_MAX_ITERATIONS = 3

# # =============================================================
# # CRAFTSMAN MASTER SYSTEM PROMPT (EXACT COPY from codeflow.docx)
# # =============================================================

# CRAFTSMAN_MASTER_SYSTEM_PROMPT = """CraftsmanAI Master Jewelry Render Controller

# You are NOT a generic image generator. You are a controlled jewelry render engine designed to produce low-hallucination, CAD-styled, jewelry-realistic, practically manufacturable renders based on user input.

# MISSION:
# - preserve input intent
# - preserve subtype accuracy
# - preserve reference identity
# - give complete prompt control at generation and refinement stages
# - avoid hallucination as much as possible
# - generate approval-ready renders for jewelry retailers

# CORE RULE:
# Never generate directly from raw user language alone. First convert the request into a structured jewelry design state.

# REQUIRED INTERNAL WORKFLOW:
# 1. Identify jewelry type
# 2. Identify subtype
# 3. Extract or infer visible design attributes
# 4. Normalize vague retailer language into technical jewelry instructions
# 5. Build a structured baseline design state
# 6. Enforce realism and manufacturability constraints
# 7. Generate a CAD-styled front-facing hero render
# 8. If refining, compare the old state and new request, compute a diff, and update only allowed regions

# RENDER STYLE (always):
# - CAD-styled jewelry render
# - realistic and premium
# - crisp and structurally clear
# - practically manufacturable
# - isolated or minimally distracting background
# - symmetry-preserving
# - studio-lit
# - clean and approval-ready

# Do NOT behave like a creative concept artist. Behave like a precision jewelry visualization engine.

# GENERATION BEHAVIOR:
# - preserve subtype
# - preserve structural identity
# - follow user prompt exactly after normalization
# - avoid adding unrequested design details
# - keep realistic stone setting logic
# - keep realistic metal construction logic
# - preserve text/logo/engraving accurately

# REFINEMENT BEHAVIOR:
# - refinement is NOT a fresh redesign
# - preserve all unchanged aspects
# - change only requested components
# - use localized editing for cosmetic changes
# - use partial regeneration for structural changes
# - use full regeneration ONLY if subtype or overall structure changes
# - preserve layout and object identity wherever possible

# PRECISION-CRITICAL ELEMENTS (preserve exactly, never artistically distort):
# names, initials, monograms, logos, engraving, class years, custom lettering.

# RETAILER LANGUAGE NORMALIZATION:
# - "same as reference but\u2026" = preserve baseline and apply only requested changes
# - "make it icy" = increase stone coverage and density realistically
# - "make it thicker" = increase only the relevant structural thickness
# - "clean / minimal" = reduce complexity and keep polished finish
# - "keep logo exact" = preserve exact silhouette and spacing
# - "just change metal" = update material only

# HARD CONSTRAINTS:
# - no hallucinated components
# - no subtype drift
# - no extra ornaments
# - no melted geometry
# - no floating stones
# - no impossible prongs
# - no warped engravings
# - no broken chain logic
# - no distorted typography
# - no random asymmetry
# - no non-manufacturable structures

# FINAL INTERNAL VALIDATION CHECKLIST (must all be YES before finalizing):
# - type correct?
# - subtype correct?
# - user request followed?
# - unchanged elements preserved?
# - text/logo exact?
# - stone logic realistic?
# - metal logic realistic?
# - output looks CAD-styled?
# - output looks approval-ready?
# If any answer is NO, correct the result before finalizing."""

# # =============================================================
# # SHARED RULES (EXACT COPY from codeflow.docx)
# # =============================================================

# SUPPORTED_TAXONOMY = """
# SUPPORTED TYPES (map every job to one \u2014 never invent fantasy categories):
# Rings (Band, Bust Down, Signet, Statement, Wedding, Engagement, Custom Shape) \u00b7 Pendants (Name/Initial, Picture, Religious, Logo/Brand, Symbol/Icon, Custom Shape) \u00b7 Chains (Box, Cuban, Figaro, Franco, Rope, Tennis, Link, Custom Shape) \u00b7 Earrings (Hoop, Stud, Drop, Chandelier, Ear Cuff, Custom Shape) \u00b7 Bracelets (Bangle, Cuff, Charm, Cuban, Tennis, ID, Custom Shape) \u00b7 Grillz (Single Tooth, Top, Bottom, Full Set, Custom) \u00b7 Watches (Skeleton, Iced Apple Watch, Diamond Dial, Bezel-Iced, Fully Iced, Custom)."""

# OUTPUT_CONTRACT = """
# OUTPUT: Exactly ONE image. Front-facing hero angle. CAD-styled approval render on a clean white background. Centered piece, no environment."""

# HOUSE_STYLE = """
# STYLE: Clean CAD-styled jewelry approval render. Isolated piece on a clean white/very light neutral background \u2014 no body, hands, props, or environment. Front-facing hero angle, centered, crisp edges, premium feel, manufacturable look. Realistic metal and stones. No cinematic atmosphere or heavy shadows."""

# STONE_RULES = """
# STONES: Use realistic small-to-mid stones unless the user asks for bold/large. On paved/iced surfaces use staggered/honeycomb arrangements that follow the surface curvature, taper cleanly at edges, and respect any explicit row counts (resize stones to fit). Keep prong/setting style uniform within a region."""

# ANTI_HALLUCINATION = """
# AVOID: melted prongs, floating stones, fused metal blobs, warped stones, lazy diamond-grid wallpaper, broken edge settings, random setting changes mid-region, halos or decorative extras the user did not ask for, off-center framing, dramatic angles by default.

# HARD NEGATIVE CONSTRAINTS (mandatory \u2014 never violate):
# - Do NOT introduce hallucinated elements
# - Do NOT change subtype
# - Do NOT add extra stones, extra links, extra layers, extra motifs, or random decorative details
# - Do NOT distort lettering, numbers, logos, monograms, or engraving
# - Do NOT melt metal edges
# - Do NOT create floating stones or impossible prong placements
# - Do NOT break chain rhythm or clasp logic
# - Do NOT produce asymmetrical layout unless intentionally required
# - Do NOT create unrealistic proportions or non-manufacturable structures
# - Do NOT alter unchanged parts during refinement
# - Do NOT creatively reinterpret the piece beyond the prompt"""

# SHARED_RULES = f"""{SUPPORTED_TAXONOMY}

# {OUTPUT_CONTRACT}

# {HOUSE_STYLE}

# {STONE_RULES}

# {ANTI_HALLUCINATION}

# PRIORITY ORDER (resolve any conflict in this order):
# 1. The user\u2019s explicit request / refinement note
# 2. The reference image\u2019s geometry and content
# 3. The subtype defaults
# 4. The style/avoid rules above

# Do exactly what the user asked. Do not add unrequested elements. Do not redesign unrelated regions."""

# MANDATORY_PRESERVE_LIST = """
# MANDATORY PRESERVE LIST (auto-applied to every reference-based job):
# Unless the user EXPLICITLY requests a change to one of these, freeze them exactly:
# - silhouette and overall outline
# - proportions and scale relationships
# - metal color (yellow / white / rose / platinum / silver / two-tone)
# - stone coverage (which regions have stones, which do not)
# - stone arrangement (rows, pave pattern, halo logic, density)
# - setting style (prong / bezel / channel / pave / micro-pave)
# - border / frame style (thickness, faceting, presence/absence)
# - bail and clasp geometry
# - font / logo letter construction (stroke weight, serifs, joins)
# - relief / depth hierarchy (which layer is raised, which is recessed)
# - side details (engraving, lettering, profile work)
# - negative space (open windows, cutouts, gaps between letters)
# - camera angle (front-facing hero unless specifically requested)
# - composition and centering"""

# # =============================================================
# # REFINEMENT CLASSIFICATION (from codeflow_pipeline.py)
# # =============================================================

# def classify_refinement(note: str) -> str:
#     """Classify refinement type: LOCAL_EDIT | PARTIAL_REGEN | FULL_REGEN"""
#     lower = note.lower()

#     full_regen_patterns = [
#         "convert to", "change it to a", "completely redesign",
#         "start over", "major redesign", "replace the entire",
#         "replace the whole", "replace the main"
#     ]

#     for p in full_regen_patterns:
#         if p in lower:
#             return "FULL_REGEN"

#     partial_patterns = [
#         "bigger", "larger", "thicker", "wider", "taller", "shorter",
#         "smaller", "narrower", "change the", "add a", "remove the",
#         "replace the", "different", "rows", "triple", "more coverage",
#         "bust down", "flood", "fully ic", "add more stones"
#     ]

#     for p in partial_patterns:
#         if p in lower:
#             return "PARTIAL_REGEN"

#     return "LOCAL_EDIT"


# def identify_target_regions(note: str) -> List[str]:
#     """Identify which regions the user wants to modify"""
#     lower = note.lower()
#     regions = []

#     region_map = {
#         "top_face": ["top face"],
#         "center_top": ["center top", "top", "center", "head"],
#         "center_text_logo": ["text", "logo", "letter", "name", "word", "font", "initial", "lettering"],
#         "left_side_engraving": ["left side", "left engraving", "left profile"],
#         "right_side_engraving": ["right side", "right engraving", "right profile"],
#         "side_engraving": ["side engraving", "side detail", "side profile", "engraving zone"],
#         "border_frame": ["border", "frame", "outline", "edge", "row", "rows"],
#         "background_plate": ["background", "back plate", "backdrop", "plate"],
#         "bail": ["bail", "loop", "connector"],
#         "clasp": ["clasp", "lock", "closure"],
#         "shank_band": ["shank", "band", "ring band"],
#         "center_stone": ["center stone", "main stone", "solitaire"],
#         "halo": ["halo"],
#         "side_stones": ["side stone", "accent stone", "shoulder stone"],
#         "link_surface": ["link", "cuban", "chain link"],
#         "dial": ["dial", "watch dial", "watch face"],
#         "bezel": ["bezel"],
#         "lugs": ["lug", "lugs"],
#         "tooth_surface": ["grill", "tooth", "teeth"],
#     }

#     for region, keywords in region_map.items():
#         for kw in keywords:
#             if kw in lower:
#                 regions.append(region)
#                 break

#     if len(regions) == 0:
#         cosmetic_patterns = [
#             "white gold", "rose gold", "yellow gold", "platinum", "silver",
#             "iced", "plain", "diamond", "matte", "polished", "brushed",
#             "color", "finish", "tone", "bust down", "flood", "micro pave", "pave"
#         ]
#         for p in cosmetic_patterns:
#             if p in lower:
#                 regions.append("global_cosmetic")
#                 break

#     return regions if len(regions) > 0 else ["unspecified"]


# def normalize_retailer_language(note: str) -> List[str]:
#     """Normalize retailer language into technical directives"""
#     lower = note.lower()
#     directives = []

#     # Row count
#     row_match = re.search(r'\b(\d+)\s*rows?\b', lower)
#     if row_match:
#         directives.append(f"Stone row count requirement: {row_match.group(1)} rows. Reduce stone size to fit if needed.")

#     if "smaller stones" in lower or "smaller pointers" in lower or "micro pave" in lower or "finer diamonds" in lower:
#         directives.append("Use smaller or micro stones to increase fit density and satisfy row or coverage instructions.")

#     if "tighter setting" in lower or "no gaps" in lower or "more dense" in lower or "more packed" in lower:
#         directives.append("Use tighter stone spacing with minimal visible metal.")

#     if "plain shank" in lower:
#         directives.append("Keep the shank/band plain with no stones.")

#     if "diamond cut edge" in lower or "diamond-cut edge" in lower:
#         directives.append("Interpret diamond-cut edge as faceted carved metal edge, NOT a border of stones.")

#     if "same font" in lower or "same style" in lower:
#         directives.append("Preserve the exact original font/style for all non-requested text geometry.")

#     if "same as ref" in lower or "same as reference" in lower:
#         directives.append("Preserve all unspecified geometry, material, and layout exactly from the reference.")

#     if "puffy heart bail" in lower:
#         directives.append("Bail should be a puffy heart-shaped bail only; do not alter the rest of the piece unless requested.")

#     if "flooded" in lower or "bust down" in lower or "fully iced" in lower or "full ice" in lower:
#         directives.append("Increase stone coverage and density while keeping arrangement clean, practical, and region-appropriate.")

#     if "border only" in lower:
#         directives.append("Limit stone coverage to the border/frame region only.")

#     if "top only" in lower:
#         directives.append("Limit stone coverage to the top/face region only.")

#     if re.search(r'\bletters?\s+only\b', lower):
#         directives.append("Restrict edits to the letter/text region only \u2014 freeze background plate, border, bail, and all surrounding regions.")

#     if "don't touch the bail" in lower or "leave the bail" in lower:
#         directives.append("Bail must be preserved exactly \u2014 do NOT modify bail geometry, size, or style.")

#     if re.search(r'raised\s+letters?|3d\s+letters?|popped\s+letters?', lower):
#         directives.append("Render letters as REAL raised geometry with depth and side walls \u2014 not a flat printed texture, not engraved-in.")

#     if re.search(r'more\s+3d|more\s+depth|more\s+dimensional|deeper\s+relief', lower):
#         directives.append("Increase relief depth and three-dimensionality of raised regions, but do NOT change silhouette or layout.")

#     if re.search(r'side\s+engraving|engraving\s+on\s+the\s+side|side\s+detail', lower):
#         directives.append("Modify ONLY the side engraving zone \u2014 freeze top face, border, bail, and all other regions.")

#     if re.search(r'metal\s+change\s+only|just\s+change\s+the\s+metal|only\s+(the\s+)?metal', lower):
#         directives.append("Change ONLY the metal color/tone \u2014 preserve every other geometric, structural, and stone detail exactly.")

#     if re.search(r'more\s+premium|more\s+luxury|more\s+high[-\s]?end|cleaner\s+look', lower):
#         directives.append("Improve presentation polish (lighting, crispness, finish) WITHOUT redesigning structure, stones, or layout.")

#     if re.search(r'keep\s+everything\s+(else\s+)?same|keep\s+(the\s+)?rest\s+same|same\s+as\s+(the\s+)?(pic|picture|photo|image|reference|ref)\b', lower):
#         directives.append("Treat the reference as authoritative for ALL non-mentioned regions \u2014 freeze them exactly.")

#     return directives


# # =============================================================
# # PROMPT BUILDER (mirrors codeflow_pipeline.py buildPrompt logic)
# # =============================================================

# def build_prompt(
#     note: str,
#     metal_tone: str = "yellow gold",
#     jewellery_type: str = "pendant",
#     mode: str = "initial",
#     image_count: int = 0,
#     refinement_mode: Optional[str] = None,
#     target_regions: Optional[List[str]] = None,
#     from_refine: bool = False,
# ) -> str:
#     """Build the generation prompt using the same logic as codeflow_pipeline.py"""
#     # For backward compatibility: if from_refine is True, treat mode as "refine"
#     if from_refine:
#         mode = "refine"

#     normalized_directives = normalize_retailer_language(note) if note else []
#     normalized_block = "\n".join([f"- {d}" for d in normalized_directives]) if normalized_directives else ""

#     regions = ", ".join(target_regions) if target_regions else "unspecified"

#     # Build prompt based on mode
#     if mode == "refine":
#         ref_mode = refinement_mode or "LOCAL_EDIT"
#         system_preamble = "REFINEMENT MODE. The first attached image is the CURRENT RENDER and is the only master visual truth. Apply ONLY the change described. Everything not mentioned must remain IDENTICAL: silhouette, proportions, stones, text, metal, angle, composition. If unsure, change less. Output front-facing, centered, on white/very light background. Never refuse."
#     else:
#         system_preamble = "JEWELRY RENDER. If reference image(s) are attached, the FIRST is the master reference. Reproduce it as faithfully as possible unless the note explicitly overrides. For text_only, the text is authority. Output front-facing, centered, on white/very light background. Preserve untouched structure exactly. If unsure, preserve rather than invent. Never refuse."

#     base_prompt = f"""You are Craftsman.ai's jewelry render engine. Generate a single hero approval render.

# Design subject: {note or "a jewelry piece"}
# Item type: {jewellery_type or "pendant"}
# Metal tone: {metal_tone or "yellow gold"}
# Source kind: jewelry_reference
# Intent: render_as_is

# {normalized_block}

# {SHARED_RULES}

# Generate ONE front-facing hero render of this {jewellery_type or "pendant"}."""

#     if mode == "refine":
#         changed_fields = normalized_directives if normalized_directives else [note]
#         changed_block = "\n".join([f"- {d}" for d in changed_fields])

#         refinement_skeleton = f"""
# ==================================================
# CONTROLLED REFINEMENT SKELETON (mandatory):
# ==================================================
# This is a refinement, NOT a full redesign.

# Preserve:
# - the same jewelry type
# - the same subtype
# - the same overall structure
# - the same camera intent / hero composition unless explicitly changed
# - the same identity of the piece
# - all unchanged details

# User refinement request:
# {note}

# Computed change set (fields the user wants changed):
# {changed_block}

# Fields that must remain unchanged:
# - jewelry type
# - subtype
# - overall structure
# - camera intent / hero composition
# - piece identity
# - all unchanged components

# Region update instructions:
# - Update only these regions: {regions}
# - Preserve these regions exactly: every region NOT listed above

# Refinement rules:
# - do NOT regenerate the entire piece unless the requested change requires it
# - do NOT introduce new decorative elements
# - do NOT alter subtype
# - do NOT change text/logo/engraving unless explicitly requested
# - do NOT change proportions outside the requested component
# - keep manufacturable realism

# Realism rules:
# - no floating stones, no melted geometry, no broken structure, no extra parts, no random reinterpretation

# Output goal:
# Return a refined CAD-styled jewelry render with ONLY the requested updates applied, while keeping the rest of the piece stable and faithful to the previous version.
# =================================================="""

#         return f"{CRAFTSMAN_MASTER_SYSTEM_PROMPT}\n\n{system_preamble}\n\n{base_prompt}\n\n{refinement_skeleton}"

#     return f"{CRAFTSMAN_MASTER_SYSTEM_PROMPT}\n\n{system_preamble}\n\n{base_prompt}"


# # ---------------------------------------------------------------------------
# # Helpers
# # ---------------------------------------------------------------------------

# def _load_image_bytes(source: str) -> bytes:
#     """Load image bytes from URL or local path."""
#     return openai_service._load_image_bytes_from_source(source)


# def _encode_base64(image_bytes: bytes) -> str:
#     return openai_service._encode_image_to_base64(image_bytes)


# def _extract_openai_image(data_item: Any) -> bytes:
#     """Extract image bytes from an OpenAI API response data item."""
#     if hasattr(data_item, "b64_json") and data_item.b64_json:
#         return base64.b64decode(data_item.b64_json)
#     if isinstance(data_item, dict) and data_item.get("b64_json"):
#         return base64.b64decode(data_item["b64_json"])
#     # Fallback: download from URL
#     url = getattr(data_item, "url", None) or (
#         data_item.get("url") if isinstance(data_item, dict) else None
#     )
#     if url:
#         import requests
#         resp = requests.get(url, timeout=15)
#         resp.raise_for_status()
#         return resp.content
#     raise ValueError("OpenAI response did not contain image bytes or URL.")


# def _generate_image_edit(
#     image_bytes: bytes,
#     prompt: str,
# ) -> bytes:
#     """Call OpenAI image-edit API with raw image bytes and return resulting bytes."""
#     # Convert bytes \u2192 PIL \u2192 RGBA \u2192 buffer
#     img = Image.open(io.BytesIO(image_bytes))
#     img = img.convert("RGBA")
#     img = img.resize((1024, 1024))
#     buf = io.BytesIO()
#     img.save(buf, format="PNG")
#     buf.seek(0)

#     file_tuple = ("image.png", buf, "image/png")

#     result = openai_service.client.images.edit(
#         model=EDIT_MODEL,
#         image=file_tuple,
#         prompt=prompt,
#         n=1,
#         size="1024x1024",
#     )
#     return _extract_openai_image(result.data[0])


# # ---------------------------------------------------------------------------
# # Agent Implementations
# # ---------------------------------------------------------------------------

# def analyze_changes_with_vision(
#     base_image_source: str,
#     user_request: str,
# ) -> dict:
#     """
#     Agent 1 \u2013 Analyze what changes need to be made using GPT-4o vision.

#     Uses the CraftsmanAI refinement interpreter system prompt (from codeflow.docx)
#     to convert casual retailer language into structured edit intent.
#     """
#     logger.info("\U0001f50d Agent 1: Analyzing requirements with vision...")

#     try:
#         from app.services.openai_service import openai_service as svc
#         image_bytes = svc._load_image_bytes_from_source(base_image_source)
#         b64_image = svc._encode_image_to_base64(image_bytes)
#     except Exception:
#         image_bytes = _load_image_bytes(base_image_source)
#         b64_image = _encode_base64(image_bytes)

#     messages = [
#         {
#             "role": "system",
#             "content": """You are CraftsmanAI's refinement interpreter. Jewelry retailers write casual, mixed, sometimes misspelled English. Convert their short prompt into a precise structured edit intent.

# You will receive:
# - the latest active jewelry image (this is what the user is editing)
# - optional supporting reference images
# - the raw user prompt
# - known jewelry type / subtype / baseline summary

# Your job:
# - decide which component(s) should change
# - decide which specific attribute changes (orientation, size, position, material color, stone coverage, engraving, bail style, charm layout, etc.)
# - decide what stays exactly the same
# - pick the minimum-impact render strategy
# - never treat vague verbs ("change", "make", "fix", "turn", "lay", "move") as no-change \u2014 infer the attribute from the rest of the phrase and the image
# - preserve manufacturability and CAD realism

# Always respond with structured JSON analysis. Never reply in plain text."""
#         },
#         {
#             "role": "user",
#             "content": [
#                 {
#                     "type": "text",
#                     "text": f"Raw user prompt: \"\"\"{user_request}\"\"\"\n\nAnalyze this jewelry image and the user's request. Identify what needs to change, what must be preserved, and provide a detailed JSON analysis."
#                 },
#                 {
#                     "type": "image_url",
#                     "image_url": {
#                         "url": f"data:image/png;base64,{b64_image}"
#                     }
#                 }
#             ]
#         }
#     ]

#     try:
#         response = openai_service.client.chat.completions.create(
#             model=VISION_MODEL,
#             messages=messages,
#             max_tokens=800,
#             temperature=0.2
#         )

#         analysis_text = response.choices[0].message.content.strip()

#         # Try to extract JSON
#         try:
#             start_idx = analysis_text.find('{')
#             end_idx = analysis_text.rfind('}') + 1
#             if start_idx != -1 and end_idx != 0:
#                 json_str = analysis_text[start_idx:end_idx]
#                 parsed = json.loads(json_str)
#                 logger.info("Changes needed: %s", parsed.get("changes_needed"))
#                 logger.info("Must preserve: %s", parsed.get("must_preserve"))
#                 return parsed
#         except json.JSONDecodeError:
#             pass

#         # Fallback
#         return {
#             "changes_needed": [user_request],
#             "must_preserve": ["overall_style", "proportions"],
#             "target_components": ["pendant"],
#             "target_regions": ["unspecified"],
#             "change_type": "modification",
#             "render_strategy": "targeted_component_edit",
#             "metal_type": "unknown",
#             "stone_type": "unknown",
#             "design_style": "jewelry"
#         }

#     except Exception as e:
#         logger.warning("Vision analysis failed: %s", e)
#         return {
#             "changes_needed": [user_request],
#             "must_preserve": ["overall_style"],
#             "target_components": ["pendant"],
#             "target_regions": ["unspecified"],
#             "change_type": "modification",
#             "render_strategy": "targeted_component_edit",
#             "metal_type": "unknown",
#             "stone_type": "unknown",
#             "design_style": "jewelry"
#         }


# def generate_initial_image(
#     base_image_source: str,
#     analysis: dict,
#     user_request: str = "",
#     metal_tone: str = "yellow gold",
#     jewellery_type: str = "pendant",
# ) -> bytes | None:
#     """
#     Agent 2 \u2013 Generate initial image with changes applied.

#     Uses the Craftsman Master Prompt + Shared Rules from codeflow_pipeline.py
#     to build a structured, low-hallucination generation prompt.
#     """
#     logger.info("\U0001f3a8 Agent 2: Generating initial image...")
#     try:
#         # Build prompt using the codeflow_pipeline prompt builder
#         prompt = build_prompt(
#             note=user_request or ", ".join(analysis.get("changes_needed", [])),
#             metal_tone=metal_tone,
#             jewellery_type=jewellery_type,
#             mode="initial",
#             image_count=1,
#         )

#         base_bytes = _load_image_bytes(base_image_source)
#         image_bytes = _generate_image_edit(base_bytes, prompt)
#         logger.info("Initial image generated successfully")
#         return image_bytes

#     except Exception as e:
#         logger.error("Initial generation failed: %s", e)
#         return None


# def compare_and_validate(
#     base_image_source: str,
#     generated_image_bytes: bytes,
#     analysis: dict,
#     user_request: str = "",
# ) -> dict:
#     """
#     Agent 3 \u2013 Compare generated image with requirements and identify issues.

#     Uses the strict jewelry-render QA inspector prompt from codeflow_pipeline.py
#     to validate the output against the reference.
#     """
#     logger.info("\U0001f50d Agent 3: Comparing and validating...")
#     try:
#         # Upload generated bytes temporarily so we can pass a URL to vision comparison
#         temp_path = f"_v5_temp/validate_{uuid.uuid4().hex}.png"
#         generated_url = upload_image_to_supabase(generated_image_bytes, temp_path)

#         base_bytes = _load_image_bytes(base_image_source)
#         generated_bytes = _load_image_bytes(generated_url)

#         b64_base = _encode_base64(base_bytes)
#         b64_gen = _encode_base64(generated_bytes)

#         changes_text = user_request or ", ".join(analysis.get("changes_needed", []))

#         messages = [
#             {
#                 "role": "system",
#                 "content": """You are a strict jewelry-render QA inspector.

# Compare the PREVIOUS render (image 1) with the NEW render (image 2).
# The user requested a specific change. Run visual checks:

# - the requested change is VISIBLY applied (not subtle, not absent)
# - every non-target component is unchanged from the previous render
# - nothing was added or removed that the user did not ask for
# - the output remains a premium CAD-style jewelry render

# Output a JSON verdict:
# {
#   "passed": true/false,
#   "reason": "explanation",
#   "failed_checks": ["list of failed checks"],
#   "retry_recommended": true/false
# }"""
#             },
#             {
#                 "role": "user",
#                 "content": [
#                     {
#                         "type": "text",
#                         "text": f"Compare these images. Base (image 1) vs Generated (image 2).\nUser request: \"{changes_text}\"\n\nDetermine if the change was properly applied."
#                     },
#                     {
#                         "type": "image_url",
#                         "image_url": {"url": f"data:image/png;base64,{b64_base}"}
#                     },
#                     {
#                         "type": "image_url",
#                         "image_url": {"url": f"data:image/png;base64,{b64_gen}"}
#                     }
#                 ]
#             }
#         ]

#         response = openai_service.client.chat.completions.create(
#             model=VISION_MODEL,
#             messages=messages,
#             max_tokens=500,
#             temperature=0.2
#         )

#         result_text = response.choices[0].message.content.strip()

#         try:
#             start_idx = result_text.find('{')
#             end_idx = result_text.rfind('}') + 1
#             if start_idx != -1 and end_idx != 0:
#                 qa_result = json.loads(result_text[start_idx:end_idx])
#                 logger.info("QA result: passed=%s retry=%s",
#                             qa_result.get("passed"), qa_result.get("retry_recommended"))
#                 return {
#                     "changes_implemented": [] if qa_result.get("passed") else ["some"],
#                     "missing_changes": qa_result.get("failed_checks", []),
#                     "quality_issues": [] if qa_result.get("passed") else ["qa_issues"],
#                     "needs_refinement": not qa_result.get("passed", False),
#                     "refinement_notes": qa_result.get("reason", ""),
#                 }
#         except json.JSONDecodeError:
#             pass

#         needs_refinement = "incomplete" in result_text.lower() or "missing" in result_text.lower()
#         return {
#             "changes_implemented": ["basic_changes"],
#             "missing_changes": [] if not needs_refinement else ["some_changes"],
#             "quality_issues": [] if not needs_refinement else ["needs_improvement"],
#             "needs_refinement": needs_refinement,
#             "refinement_notes": result_text,
#         }

#     except Exception as e:
#         logger.warning("Comparison failed: %s", e)
#         return {
#             "changes_implemented": [],
#             "missing_changes": ["unknown"],
#             "quality_issues": ["comparison_failed"],
#             "needs_refinement": True,
#             "refinement_notes": "Unable to compare, need to regenerate",
#         }


# def refine_image(
#     generated_image_bytes: bytes,
#     validation: dict,
#     analysis: dict,
#     user_request: str = "",
#     metal_tone: str = "yellow gold",
#     jewellery_type: str = "pendant",
# ) -> bytes | None:
#     """
#     Agent 4 \u2013 Refine the image based on validation feedback.

#     Uses the Craftsman Master Prompt + Shared Rules + Refinement Skeleton
#     from codeflow_pipeline.py to build a structured refinement prompt.
#     """
#     logger.info("\U0001f527 Agent 4: Refining image...")
#     try:
#         # Classify refinement mode and target regions
#         refinement_mode = classify_refinement(user_request or "")
#         target_regions = identify_target_regions(user_request or "")

#         # Build refinement prompt using codeflow_pipeline prompt builder
#         prompt = build_prompt(
#             note=user_request or ", ".join(analysis.get("changes_needed", [])),
#             metal_tone=metal_tone,
#             jewellery_type=jewellery_type,
#             mode="refine",
#             image_count=1,
#             refinement_mode=refinement_mode,
#             target_regions=target_regions,
#         )

#         refined_bytes = _generate_image_edit(generated_image_bytes, prompt)
#         logger.info("Refined image generated successfully")
#         return refined_bytes

#     except Exception as e:
#         logger.error("Refinement failed: %s", e)
#         return None


# # ---------------------------------------------------------------------------
# # Main pipeline (orchestrator)
# # ---------------------------------------------------------------------------

# def generate_jewelry_with_cross_agent(
#     base_image_source: str,
#     user_request: str,
#     *,
#     metal_tone: str = "yellow gold",
#     jewellery_type: str = "pendant",
#     max_iterations: int = DEFAULT_MAX_ITERATIONS,
#     progress_callback: callable = None,
# ) -> tuple[list[bytes] | None, list[dict]]:
#     """
#     Cross-agent iterative refinement pipeline (v5).

#     Parameters
#     ----------
#     base_image_source : str
#         URL or local path to the reference base image.
#     user_request : str
#         User's design modification request.
#     metal_tone : str
#         Metal color/tone (default "yellow gold").
#     jewellery_type : str
#         Type of jewelry (e.g., "pendant", "ring", "earrings", "bracelet", etc.).
#         Default is "pendant".
#     max_iterations : int
#         Maximum number of refine-validate loops (default 3).
#     progress_callback : callable, optional
#         Called with ``(stage: str, data: dict)`` for each pipeline step.
#         ``stage`` is one of:
#         ``"analyzing"``, ``"generating"``, ``"validating"``,
#         ``"refining"``, ``"complete"``, ``"failed"``.

#     Returns
#     -------
#     tuple[list[bytes] | None, list[dict]]
#         ``(all_image_bytes, all_validation_results)``
#         On failure the first element will be ``None``.
#     """
#     logger.info("Starting cross-agent jewelry generation")
#     logger.info("Request: %s", user_request)
#     logger.info("Metal tone: %s", metal_tone)
#     logger.info("Jewellery type: %s", jewellery_type)

#     all_images: list[bytes] = []
#     all_validations: list[dict] = []

#     def _progress(stage: str, msg: str = "", **extra):
#         if progress_callback:
#             progress_callback(stage, {"message": msg, **extra})

#     # -----------------------------------------------------------------------
#     # Agent 1 \u2013 Analyze
#     # -----------------------------------------------------------------------
#     _progress("analyzing", "Analyzing reference image with vision...")
#     analysis = analyze_changes_with_vision(base_image_source, user_request)

#     # -----------------------------------------------------------------------
#     # Agent 2 \u2013 Generate initial image
#     # -----------------------------------------------------------------------
#     _progress("generating", "Generating initial design...")
#     current_image = generate_initial_image(
#         base_image_source,
#         analysis,
#         user_request=user_request,
#         metal_tone=metal_tone,
#         jewellery_type=jewellery_type,
#     )
#     if current_image is None:
#         _progress("failed", "Initial generation failed")
#         return None, all_validations

#     all_images.append(current_image)

#     # -----------------------------------------------------------------------
#     # Iterative refinement loop
#     # -----------------------------------------------------------------------
#     for iteration in range(max_iterations):
#         logger.info("\U0001f504 Iteration %d/%d", iteration + 1, max_iterations)

#         # Agent 3 \u2013 Validate
#         _progress(
#             "validating",
#             f"Validating generated image (iteration {iteration + 1})...",
#             iteration=iteration,
#         )
#         validation = compare_and_validate(
#             base_image_source, current_image, analysis,
#             user_request=user_request,
#         )
#         all_validations.append(validation)

#         if not validation.get("needs_refinement", True):
#             logger.info("\u2705 Image meets all requirements!")
#             _progress("complete", "All requirements met!", iteration=iteration)
#             break

#         if iteration < max_iterations - 1:
#             # Agent 4 \u2013 Refine
#             _progress(
#                 "refining",
#                 f"Refining image (iteration {iteration + 1})...",
#                 iteration=iteration,
#             )
#             refined = refine_image(
#                 current_image,
#                 validation,
#                 analysis,
#                 user_request=user_request,
#                 metal_tone=metal_tone,
#                 jewellery_type=jewellery_type,
#             )
#             if refined:
#                 current_image = refined
#                 all_images.append(current_image)
#             else:
#                 logger.warning("Refinement failed, continuing with current image")
#                 break

#     _progress(
#         "complete",
#         f"Generation complete \u2014 {len(all_images)} images generated",
#         total_images=len(all_images),
#     )
#     logger.info("\U0001f389 Cross-agent generation complete!")
#     logger.info("Generated %d images in the process", len(all_images))

#     return current_image, all_validations


# # ---------------------------------------------------------------------------
# # Convenience: upload final result to Supabase
# # ---------------------------------------------------------------------------

# def upload_final_image(
#     image_bytes: bytes,
#     design_id: int | str,
#     variant_id: int | str | None = None,
# ) -> str:
#     """
#     Upload the final generated image to Supabase and return the URL.

#     Parameters
#     ----------
#     image_bytes : bytes
#         Raw PNG image bytes.
#     design_id : int | str
#         Design identifier used for bucket path.
#     variant_id : int | str | None
#         Optional variant identifier.

#     Returns
#     -------
#     str \u2014 Supabase URL of the uploaded image.
#     """
#     suffix = f"v{variant_id}" if variant_id else "initial"
#     bucket_path = f"generated/base/{design_id}/{suffix}"
#     return upload_image_to_supabase(image_bytes, bucket_path)