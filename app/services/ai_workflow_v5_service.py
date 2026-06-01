"""
Cross-Agent Iterative Refinement Pipeline (v5)
======================================================================
Integrates with the existing OpenAIService singleton for all API calls,
and uses Supabase storage instead of local filesystem saving.

Pipeline (from codeflow_pipeline.py / codeflow.docx):
  Agent 1 → analyze_changes_with_vision()
  Agent 2 → generate_initial_image()
  Agent 3 → compare_and_validate()
  Agent 4 → refine_image()

All prompts and pipeline logic are ported from codeflow_pipeline.py.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import re
import uuid
from typing import Any, List, Optional

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

# =============================================================
# CRAFTSMAN MASTER SYSTEM PROMPT (EXACT COPY from codeflow.docx)
# =============================================================

CRAFTSMAN_MASTER_SYSTEM_PROMPT = """CraftsmanAI Master Jewelry Render Controller

You are NOT a generic image generator. You are a controlled jewelry render engine designed to produce low-hallucination, CAD-styled, jewelry-realistic, practically manufacturable renders based on user input.

MISSION:
- preserve input intent
- preserve subtype accuracy
- preserve reference identity
- give complete prompt control at generation and refinement stages
- avoid hallucination as much as possible
- generate approval-ready renders for jewelry retailers

CORE RULE:
Never generate directly from raw user language alone. First convert the request into a structured jewelry design state.

REQUIRED INTERNAL WORKFLOW:
1. Identify jewelry type
2. Identify subtype
3. Extract or infer visible design attributes
4. Normalize vague retailer language into technical jewelry instructions
5. Build a structured baseline design state
6. Enforce realism and manufacturability constraints
7. Generate a CAD-styled front-facing hero render
8. If refining, compare the old state and new request, compute a diff, and update only allowed regions

RENDER STYLE (always):
- CAD-styled jewelry render
- realistic and premium
- crisp and structurally clear
- practically manufacturable
- isolated or minimally distracting background
- symmetry-preserving
- studio-lit
- clean and approval-ready

Do NOT behave like a creative concept artist. Behave like a precision jewelry visualization engine.

GENERATION BEHAVIOR:
- preserve subtype
- preserve structural identity
- follow user prompt exactly after normalization
- avoid adding unrequested design details
- keep realistic stone setting logic
- keep realistic metal construction logic
- preserve text/logo/engraving accurately

REFINEMENT BEHAVIOR:
- refinement is NOT a fresh redesign
- preserve all unchanged aspects
- change only requested components
- use localized editing for cosmetic changes
- use partial regeneration for structural changes
- use full regeneration ONLY if subtype or overall structure changes
- preserve layout and object identity wherever possible

PRECISION-CRITICAL ELEMENTS (preserve exactly, never artistically distort):
names, initials, monograms, logos, engraving, class years, custom lettering.

RETAILER LANGUAGE NORMALIZATION:
- "same as reference but\u2026" = preserve baseline and apply only requested changes
- "make it icy" = increase stone coverage and density realistically
- "make it thicker" = increase only the relevant structural thickness
- "clean / minimal" = reduce complexity and keep polished finish
- "keep logo exact" = preserve exact silhouette and spacing
- "just change metal" = update material only

HARD CONSTRAINTS:
- no hallucinated components
- no subtype drift
- no extra ornaments
- no melted geometry
- no floating stones
- no impossible prongs
- no warped engravings
- no broken chain logic
- no distorted typography
- no random asymmetry
- no non-manufacturable structures

FINAL INTERNAL VALIDATION CHECKLIST (must all be YES before finalizing):
- type correct?
- subtype correct?
- user request followed?
- unchanged elements preserved?
- text/logo exact?
- stone logic realistic?
- metal logic realistic?
- output looks CAD-styled?
- output looks approval-ready?
If any answer is NO, correct the result before finalizing."""

# =============================================================
# SHARED RULES (EXACT COPY from codeflow.docx)
# =============================================================

SUPPORTED_TAXONOMY = """
SUPPORTED TYPES (map every job to one \u2014 never invent fantasy categories):
Rings (Band, Bust Down, Signet, Statement, Wedding, Engagement, Custom Shape) \u00b7 Pendants (Name/Initial, Picture, Religious, Logo/Brand, Symbol/Icon, Custom Shape) \u00b7 Chains (Box, Cuban, Figaro, Franco, Rope, Tennis, Link, Custom Shape) \u00b7 Earrings (Hoop, Stud, Drop, Chandelier, Ear Cuff, Custom Shape) \u00b7 Bracelets (Bangle, Cuff, Charm, Cuban, Tennis, ID, Custom Shape) \u00b7 Grillz (Single Tooth, Top, Bottom, Full Set, Custom) \u00b7 Watches (Skeleton, Iced Apple Watch, Diamond Dial, Bezel-Iced, Fully Iced, Custom)."""

OUTPUT_CONTRACT = """
OUTPUT: Exactly ONE image. Front-facing hero angle. CAD-styled approval render on a clean white background. Centered piece, no environment."""

HOUSE_STYLE = """
STYLE: Clean CAD-styled jewelry approval render. Isolated piece on a clean white/very light neutral background \u2014 no body, hands, props, or environment. Front-facing hero angle, centered, crisp edges, premium feel, manufacturable look. Realistic metal and stones. No cinematic atmosphere or heavy shadows."""

STONE_RULES = """
STONES: Use realistic small-to-mid stones unless the user asks for bold/large. On paved/iced surfaces use staggered/honeycomb arrangements that follow the surface curvature, taper cleanly at edges, and respect any explicit row counts (resize stones to fit). Keep prong/setting style uniform within a region."""

ANTI_HALLUCINATION = """
AVOID: melted prongs, floating stones, fused metal blobs, warped stones, lazy diamond-grid wallpaper, broken edge settings, random setting changes mid-region, halos or decorative extras the user did not ask for, off-center framing, dramatic angles by default.

HARD NEGATIVE CONSTRAINTS (mandatory \u2014 never violate):
- Do NOT introduce hallucinated elements
- Do NOT change subtype
- Do NOT add extra stones, extra links, extra layers, extra motifs, or random decorative details
- Do NOT distort lettering, numbers, logos, monograms, or engraving
- Do NOT melt metal edges
- Do NOT create floating stones or impossible prong placements
- Do NOT break chain rhythm or clasp logic
- Do NOT produce asymmetrical layout unless intentionally required
- Do NOT create unrealistic proportions or non-manufacturable structures
- Do NOT alter unchanged parts during refinement
- Do NOT creatively reinterpret the piece beyond the prompt"""

SHARED_RULES = f"""{SUPPORTED_TAXONOMY}

{OUTPUT_CONTRACT}

{HOUSE_STYLE}

{STONE_RULES}

{ANTI_HALLUCINATION}

PRIORITY ORDER (resolve any conflict in this order):
1. The user\u2019s explicit request / refinement note
2. The reference image\u2019s geometry and content
3. The subtype defaults
4. The style/avoid rules above

Do exactly what the user asked. Do not add unrequested elements. Do not redesign unrelated regions."""

MANDATORY_PRESERVE_LIST = """
MANDATORY PRESERVE LIST (auto-applied to every reference-based job):
Unless the user EXPLICITLY requests a change to one of these, freeze them exactly:
- silhouette and overall outline
- proportions and scale relationships
- metal color (yellow / white / rose / platinum / silver / two-tone)
- stone coverage (which regions have stones, which do not)
- stone arrangement (rows, pave pattern, halo logic, density)
- setting style (prong / bezel / channel / pave / micro-pave)
- border / frame style (thickness, faceting, presence/absence)
- bail and clasp geometry
- font / logo letter construction (stroke weight, serifs, joins)
- relief / depth hierarchy (which layer is raised, which is recessed)
- side details (engraving, lettering, profile work)
- negative space (open windows, cutouts, gaps between letters)
- camera angle (front-facing hero unless specifically requested)
- composition and centering"""

# =============================================================
# REFINEMENT CLASSIFICATION (from codeflow_pipeline.py)
# =============================================================

def classify_refinement(note: str) -> str:
    """Classify refinement type: LOCAL_EDIT | PARTIAL_REGEN | FULL_REGEN"""
    lower = note.lower()

    full_regen_patterns = [
        "convert to", "change it to a", "completely redesign",
        "start over", "major redesign", "replace the entire",
        "replace the whole", "replace the main"
    ]

    for p in full_regen_patterns:
        if p in lower:
            return "FULL_REGEN"

    partial_patterns = [
        "bigger", "larger", "thicker", "wider", "taller", "shorter",
        "smaller", "narrower", "change the", "add a", "remove the",
        "replace the", "different", "rows", "triple", "more coverage",
        "bust down", "flood", "fully ic", "add more stones"
    ]

    for p in partial_patterns:
        if p in lower:
            return "PARTIAL_REGEN"

    return "LOCAL_EDIT"


def identify_target_regions(note: str) -> List[str]:
    """Identify which regions the user wants to modify"""
    lower = note.lower()
    regions = []

    region_map = {
        "top_face": ["top face"],
        "center_top": ["center top", "top", "center", "head"],
        "center_text_logo": ["text", "logo", "letter", "name", "word", "font", "initial", "lettering"],
        "left_side_engraving": ["left side", "left engraving", "left profile"],
        "right_side_engraving": ["right side", "right engraving", "right profile"],
        "side_engraving": ["side engraving", "side detail", "side profile", "engraving zone"],
        "border_frame": ["border", "frame", "outline", "edge", "row", "rows"],
        "background_plate": ["background", "back plate", "backdrop", "plate"],
        "bail": ["bail", "loop", "connector"],
        "clasp": ["clasp", "lock", "closure"],
        "shank_band": ["shank", "band", "ring band"],
        "center_stone": ["center stone", "main stone", "solitaire"],
        "halo": ["halo"],
        "side_stones": ["side stone", "accent stone", "shoulder stone"],
        "link_surface": ["link", "cuban", "chain link"],
        "dial": ["dial", "watch dial", "watch face"],
        "bezel": ["bezel"],
        "lugs": ["lug", "lugs"],
        "tooth_surface": ["grill", "tooth", "teeth"],
    }

    for region, keywords in region_map.items():
        for kw in keywords:
            if kw in lower:
                regions.append(region)
                break

    if len(regions) == 0:
        cosmetic_patterns = [
            "white gold", "rose gold", "yellow gold", "platinum", "silver",
            "iced", "plain", "diamond", "matte", "polished", "brushed",
            "color", "finish", "tone", "bust down", "flood", "micro pave", "pave"
        ]
        for p in cosmetic_patterns:
            if p in lower:
                regions.append("global_cosmetic")
                break

    return regions if len(regions) > 0 else ["unspecified"]


def normalize_retailer_language(note: str) -> List[str]:
    """Normalize retailer language into technical directives"""
    lower = note.lower()
    directives = []

    # Row count
    row_match = re.search(r'\b(\d+)\s*rows?\b', lower)
    if row_match:
        directives.append(f"Stone row count requirement: {row_match.group(1)} rows. Reduce stone size to fit if needed.")

    if "smaller stones" in lower or "smaller pointers" in lower or "micro pave" in lower or "finer diamonds" in lower:
        directives.append("Use smaller or micro stones to increase fit density and satisfy row or coverage instructions.")

    if "tighter setting" in lower or "no gaps" in lower or "more dense" in lower or "more packed" in lower:
        directives.append("Use tighter stone spacing with minimal visible metal.")

    if "plain shank" in lower:
        directives.append("Keep the shank/band plain with no stones.")

    if "diamond cut edge" in lower or "diamond-cut edge" in lower:
        directives.append("Interpret diamond-cut edge as faceted carved metal edge, NOT a border of stones.")

    if "same font" in lower or "same style" in lower:
        directives.append("Preserve the exact original font/style for all non-requested text geometry.")

    if "same as ref" in lower or "same as reference" in lower:
        directives.append("Preserve all unspecified geometry, material, and layout exactly from the reference.")

    if "puffy heart bail" in lower:
        directives.append("Bail should be a puffy heart-shaped bail only; do not alter the rest of the piece unless requested.")

    if "flooded" in lower or "bust down" in lower or "fully iced" in lower or "full ice" in lower:
        directives.append("Increase stone coverage and density while keeping arrangement clean, practical, and region-appropriate.")

    if "border only" in lower:
        directives.append("Limit stone coverage to the border/frame region only.")

    if "top only" in lower:
        directives.append("Limit stone coverage to the top/face region only.")

    if re.search(r'\bletters?\s+only\b', lower):
        directives.append("Restrict edits to the letter/text region only \u2014 freeze background plate, border, bail, and all surrounding regions.")

    if "don't touch the bail" in lower or "leave the bail" in lower:
        directives.append("Bail must be preserved exactly \u2014 do NOT modify bail geometry, size, or style.")

    if re.search(r'raised\s+letters?|3d\s+letters?|popped\s+letters?', lower):
        directives.append("Render letters as REAL raised geometry with depth and side walls \u2014 not a flat printed texture, not engraved-in.")

    if re.search(r'more\s+3d|more\s+depth|more\s+dimensional|deeper\s+relief', lower):
        directives.append("Increase relief depth and three-dimensionality of raised regions, but do NOT change silhouette or layout.")

    if re.search(r'side\s+engraving|engraving\s+on\s+the\s+side|side\s+detail', lower):
        directives.append("Modify ONLY the side engraving zone \u2014 freeze top face, border, bail, and all other regions.")

    if re.search(r'metal\s+change\s+only|just\s+change\s+the\s+metal|only\s+(the\s+)?metal', lower):
        directives.append("Change ONLY the metal color/tone \u2014 preserve every other geometric, structural, and stone detail exactly.")

    if re.search(r'more\s+premium|more\s+luxury|more\s+high[-\s]?end|cleaner\s+look', lower):
        directives.append("Improve presentation polish (lighting, crispness, finish) WITHOUT redesigning structure, stones, or layout.")

    if re.search(r'keep\s+everything\s+(else\s+)?same|keep\s+(the\s+)?rest\s+same|same\s+as\s+(the\s+)?(pic|picture|photo|image|reference|ref)\b', lower):
        directives.append("Treat the reference as authoritative for ALL non-mentioned regions \u2014 freeze them exactly.")

    return directives


# =============================================================
# PROMPT BUILDER (mirrors codeflow_pipeline.py buildPrompt logic)
# =============================================================

def build_prompt(
    note: str,
    metal_tone: str = "yellow gold",
    jewellery_type: str = "pendant",
    mode: str = "initial",
    image_count: int = 0,
    refinement_mode: Optional[str] = None,
    target_regions: Optional[List[str]] = None,
    from_refine: bool = False,
) -> str:
    """Build the generation prompt using the same logic as codeflow_pipeline.py"""
    # For backward compatibility: if from_refine is True, treat mode as "refine"
    if from_refine:
        mode = "refine"

    normalized_directives = normalize_retailer_language(note) if note else []
    normalized_block = "\n".join([f"- {d}" for d in normalized_directives]) if normalized_directives else ""

    regions = ", ".join(target_regions) if target_regions else "unspecified"

    # Build prompt based on mode
    if mode == "refine":
        ref_mode = refinement_mode or "LOCAL_EDIT"
        system_preamble = "REFINEMENT MODE. The first attached image is the CURRENT RENDER and is the only master visual truth. Apply ONLY the change described. Everything not mentioned must remain IDENTICAL: silhouette, proportions, stones, text, metal, angle, composition. If unsure, change less. Output front-facing, centered, on white/very light background. Never refuse."
    else:
        system_preamble = "JEWELRY RENDER. If reference image(s) are attached, the FIRST is the master reference. Reproduce it as faithfully as possible unless the note explicitly overrides. For text_only, the text is authority. Output front-facing, centered, on white/very light background. Preserve untouched structure exactly. If unsure, preserve rather than invent. Never refuse."

    base_prompt = f"""You are Craftsman.ai's jewelry render engine. Generate a single hero approval render.

Design subject: {note or "a jewelry piece"}
Item type: {jewellery_type or "pendant"}
Metal tone: {metal_tone or "yellow gold"}
Source kind: jewelry_reference
Intent: render_as_is

{normalized_block}

{SHARED_RULES}

Generate ONE front-facing hero render of this {jewellery_type or "pendant"}."""

    if mode == "refine":
        changed_fields = normalized_directives if normalized_directives else [note]
        changed_block = "\n".join([f"- {d}" for d in changed_fields])

        refinement_skeleton = f"""
==================================================
CONTROLLED REFINEMENT SKELETON (mandatory):
==================================================
This is a refinement, NOT a full redesign.

Preserve:
- the same jewelry type
- the same subtype
- the same overall structure
- the same camera intent / hero composition unless explicitly changed
- the same identity of the piece
- all unchanged details

User refinement request:
{note}

Computed change set (fields the user wants changed):
{changed_block}

Fields that must remain unchanged:
- jewelry type
- subtype
- overall structure
- camera intent / hero composition
- piece identity
- all unchanged components

Region update instructions:
- Update only these regions: {regions}
- Preserve these regions exactly: every region NOT listed above

Refinement rules:
- do NOT regenerate the entire piece unless the requested change requires it
- do NOT introduce new decorative elements
- do NOT alter subtype
- do NOT change text/logo/engraving unless explicitly requested
- do NOT change proportions outside the requested component
- keep manufacturable realism

Realism rules:
- no floating stones, no melted geometry, no broken structure, no extra parts, no random reinterpretation

Output goal:
Return a refined CAD-styled jewelry render with ONLY the requested updates applied, while keeping the rest of the piece stable and faithful to the previous version.
=================================================="""

        return f"{CRAFTSMAN_MASTER_SYSTEM_PROMPT}\n\n{system_preamble}\n\n{base_prompt}\n\n{refinement_skeleton}"

    return f"{CRAFTSMAN_MASTER_SYSTEM_PROMPT}\n\n{system_preamble}\n\n{base_prompt}"


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
    # Convert bytes \u2192 PIL \u2192 RGBA \u2192 buffer
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
    Agent 1 \u2013 Analyze what changes need to be made using GPT-4o vision.

    Uses the CraftsmanAI refinement interpreter system prompt (from codeflow.docx)
    to convert casual retailer language into structured edit intent.
    """
    logger.info("\U0001f50d Agent 1: Analyzing requirements with vision...")

    try:
        from app.services.openai_service import openai_service as svc
        image_bytes = svc._load_image_bytes_from_source(base_image_source)
        b64_image = svc._encode_image_to_base64(image_bytes)
    except Exception:
        image_bytes = _load_image_bytes(base_image_source)
        b64_image = _encode_base64(image_bytes)

    messages = [
        {
            "role": "system",
            "content": """You are CraftsmanAI's refinement interpreter. Jewelry retailers write casual, mixed, sometimes misspelled English. Convert their short prompt into a precise structured edit intent.

You will receive:
- the latest active jewelry image (this is what the user is editing)
- optional supporting reference images
- the raw user prompt
- known jewelry type / subtype / baseline summary

Your job:
- decide which component(s) should change
- decide which specific attribute changes (orientation, size, position, material color, stone coverage, engraving, bail style, charm layout, etc.)
- decide what stays exactly the same
- pick the minimum-impact render strategy
- never treat vague verbs ("change", "make", "fix", "turn", "lay", "move") as no-change \u2014 infer the attribute from the rest of the phrase and the image
- preserve manufacturability and CAD realism

Always respond with structured JSON analysis. Never reply in plain text."""
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": f"Raw user prompt: \"\"\"{user_request}\"\"\"\n\nAnalyze this jewelry image and the user's request. Identify what needs to change, what must be preserved, and provide a detailed JSON analysis."
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/png;base64,{b64_image}"
                    }
                }
            ]
        }
    ]

    try:
        response = openai_service.client.chat.completions.create(
            model=VISION_MODEL,
            messages=messages,
            max_tokens=800,
            temperature=0.2
        )

        analysis_text = response.choices[0].message.content.strip()

        # Try to extract JSON
        try:
            start_idx = analysis_text.find('{')
            end_idx = analysis_text.rfind('}') + 1
            if start_idx != -1 and end_idx != 0:
                json_str = analysis_text[start_idx:end_idx]
                parsed = json.loads(json_str)
                logger.info("Changes needed: %s", parsed.get("changes_needed"))
                logger.info("Must preserve: %s", parsed.get("must_preserve"))
                return parsed
        except json.JSONDecodeError:
            pass

        # Fallback
        return {
            "changes_needed": [user_request],
            "must_preserve": ["overall_style", "proportions"],
            "target_components": ["pendant"],
            "target_regions": ["unspecified"],
            "change_type": "modification",
            "render_strategy": "targeted_component_edit",
            "metal_type": "unknown",
            "stone_type": "unknown",
            "design_style": "jewelry"
        }

    except Exception as e:
        logger.warning("Vision analysis failed: %s", e)
        return {
            "changes_needed": [user_request],
            "must_preserve": ["overall_style"],
            "target_components": ["pendant"],
            "target_regions": ["unspecified"],
            "change_type": "modification",
            "render_strategy": "targeted_component_edit",
            "metal_type": "unknown",
            "stone_type": "unknown",
            "design_style": "jewelry"
        }


def generate_initial_image(
    base_image_source: str,
    analysis: dict,
    user_request: str = "",
    metal_tone: str = "yellow gold",
    jewellery_type: str = "pendant",
) -> bytes | None:
    """
    Agent 2 \u2013 Generate initial image with changes applied.

    Uses the Craftsman Master Prompt + Shared Rules from codeflow_pipeline.py
    to build a structured, low-hallucination generation prompt.
    """
    logger.info("\U0001f3a8 Agent 2: Generating initial image...")
    try:
        # Build prompt using the codeflow_pipeline prompt builder
        prompt = build_prompt(
            note=user_request or ", ".join(analysis.get("changes_needed", [])),
            metal_tone=metal_tone,
            jewellery_type=jewellery_type,
            mode="initial",
            image_count=1,
        )

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
    user_request: str = "",
) -> dict:
    """
    Agent 3 \u2013 Compare generated image with requirements and identify issues.

    Uses the strict jewelry-render QA inspector prompt from codeflow_pipeline.py
    to validate the output against the reference.
    """
    logger.info("\U0001f50d Agent 3: Comparing and validating...")
    try:
        # Upload generated bytes temporarily so we can pass a URL to vision comparison
        temp_path = f"_v5_temp/validate_{uuid.uuid4().hex}.png"
        generated_url = upload_image_to_supabase(generated_image_bytes, temp_path)

        base_bytes = _load_image_bytes(base_image_source)
        generated_bytes = _load_image_bytes(generated_url)

        b64_base = _encode_base64(base_bytes)
        b64_gen = _encode_base64(generated_bytes)

        changes_text = user_request or ", ".join(analysis.get("changes_needed", []))

        messages = [
            {
                "role": "system",
                "content": """You are a strict jewelry-render QA inspector.

Compare the PREVIOUS render (image 1) with the NEW render (image 2).
The user requested a specific change. Run visual checks:

- the requested change is VISIBLY applied (not subtle, not absent)
- every non-target component is unchanged from the previous render
- nothing was added or removed that the user did not ask for
- the output remains a premium CAD-style jewelry render

Output a JSON verdict:
{
  "passed": true/false,
  "reason": "explanation",
  "failed_checks": ["list of failed checks"],
  "retry_recommended": true/false
}"""
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Compare these images. Base (image 1) vs Generated (image 2).\nUser request: \"{changes_text}\"\n\nDetermine if the change was properly applied."
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64_base}"}
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64_gen}"}
                    }
                ]
            }
        ]

        response = openai_service.client.chat.completions.create(
            model=VISION_MODEL,
            messages=messages,
            max_tokens=500,
            temperature=0.2
        )

        result_text = response.choices[0].message.content.strip()

        try:
            start_idx = result_text.find('{')
            end_idx = result_text.rfind('}') + 1
            if start_idx != -1 and end_idx != 0:
                qa_result = json.loads(result_text[start_idx:end_idx])
                logger.info("QA result: passed=%s retry=%s",
                            qa_result.get("passed"), qa_result.get("retry_recommended"))
                return {
                    "changes_implemented": [] if qa_result.get("passed") else ["some"],
                    "missing_changes": qa_result.get("failed_checks", []),
                    "quality_issues": [] if qa_result.get("passed") else ["qa_issues"],
                    "needs_refinement": not qa_result.get("passed", False),
                    "refinement_notes": qa_result.get("reason", ""),
                }
        except json.JSONDecodeError:
            pass

        needs_refinement = "incomplete" in result_text.lower() or "missing" in result_text.lower()
        return {
            "changes_implemented": ["basic_changes"],
            "missing_changes": [] if not needs_refinement else ["some_changes"],
            "quality_issues": [] if not needs_refinement else ["needs_improvement"],
            "needs_refinement": needs_refinement,
            "refinement_notes": result_text,
        }

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
    user_request: str = "",
    metal_tone: str = "yellow gold",
    jewellery_type: str = "pendant",
) -> bytes | None:
    """
    Agent 4 \u2013 Refine the image based on validation feedback.

    Uses the Craftsman Master Prompt + Shared Rules + Refinement Skeleton
    from codeflow_pipeline.py to build a structured refinement prompt.
    """
    logger.info("\U0001f527 Agent 4: Refining image...")
    try:
        # Classify refinement mode and target regions
        refinement_mode = classify_refinement(user_request or "")
        target_regions = identify_target_regions(user_request or "")

        # Build refinement prompt using codeflow_pipeline prompt builder
        prompt = build_prompt(
            note=user_request or ", ".join(analysis.get("changes_needed", [])),
            metal_tone=metal_tone,
            jewellery_type=jewellery_type,
            mode="refine",
            image_count=1,
            refinement_mode=refinement_mode,
            target_regions=target_regions,
        )

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
    metal_tone: str = "yellow gold",
    jewellery_type: str = "pendant",
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
    metal_tone : str
        Metal color/tone (default "yellow gold").
    jewellery_type : str
        Type of jewelry (e.g., "pendant", "ring", "earrings", "bracelet", etc.).
        Default is "pendant".
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
    logger.info("Metal tone: %s", metal_tone)
    logger.info("Jewellery type: %s", jewellery_type)

    all_images: list[bytes] = []
    all_validations: list[dict] = []

    def _progress(stage: str, msg: str = "", **extra):
        if progress_callback:
            progress_callback(stage, {"message": msg, **extra})

    # -----------------------------------------------------------------------
    # Agent 1 \u2013 Analyze
    # -----------------------------------------------------------------------
    _progress("analyzing", "Analyzing reference image with vision...")
    analysis = analyze_changes_with_vision(base_image_source, user_request)

    # -----------------------------------------------------------------------
    # Agent 2 \u2013 Generate initial image
    # -----------------------------------------------------------------------
    _progress("generating", "Generating initial design...")
    current_image = generate_initial_image(
        base_image_source,
        analysis,
        user_request=user_request,
        metal_tone=metal_tone,
        jewellery_type=jewellery_type,
    )
    if current_image is None:
        _progress("failed", "Initial generation failed")
        return None, all_validations

    all_images.append(current_image)

    # -----------------------------------------------------------------------
    # Iterative refinement loop
    # -----------------------------------------------------------------------
    for iteration in range(max_iterations):
        logger.info("\U0001f504 Iteration %d/%d", iteration + 1, max_iterations)

        # Agent 3 \u2013 Validate
        _progress(
            "validating",
            f"Validating generated image (iteration {iteration + 1})...",
            iteration=iteration,
        )
        validation = compare_and_validate(
            base_image_source, current_image, analysis,
            user_request=user_request,
        )
        all_validations.append(validation)

        if not validation.get("needs_refinement", True):
            logger.info("\u2705 Image meets all requirements!")
            _progress("complete", "All requirements met!", iteration=iteration)
            break

        if iteration < max_iterations - 1:
            # Agent 4 \u2013 Refine
            _progress(
                "refining",
                f"Refining image (iteration {iteration + 1})...",
                iteration=iteration,
            )
            refined = refine_image(
                current_image,
                validation,
                analysis,
                user_request=user_request,
                metal_tone=metal_tone,
                jewellery_type=jewellery_type,
            )
            if refined:
                current_image = refined
                all_images.append(current_image)
            else:
                logger.warning("Refinement failed, continuing with current image")
                break

    _progress(
        "complete",
        f"Generation complete \u2014 {len(all_images)} images generated",
        total_images=len(all_images),
    )
    logger.info("\U0001f389 Cross-agent generation complete!")
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
    str \u2014 Supabase URL of the uploaded image.
    """
    suffix = f"v{variant_id}" if variant_id else "initial"
    bucket_path = f"generated/base/{design_id}/{suffix}"
    return upload_image_to_supabase(image_bytes, bucket_path)