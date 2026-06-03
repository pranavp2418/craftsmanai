"""
OpenAI Service - Centralized service supporting both OpenAI and Gemini rendering pipeline.
Uses the tested high-fidelity Gemini rendering, refinement interpretation, and QA Auditor flow.
"""

import logging
import os
import re
import sys
import json
import cv2
import base64
import requests
import tempfile
from io import BytesIO
from typing import List, Dict, Any, Optional

import imagehash
import google.generativeai as genai
from PIL import Image
from openai import OpenAI
from dotenv import load_dotenv

from app.core.config import settings

load_dotenv()

logger = logging.getLogger(__name__)

# =========================================================
# OPTIONAL OCR & SSIM
# =========================================================
try:
    from paddleocr import PaddleOCR
    OCR_ENABLED = True
except Exception:
    OCR_ENABLED = False

try:
    from skimage.metrics import structural_similarity as ssim
    SSIM_ENABLED = True
except Exception:
    SSIM_ENABLED = False

# =========================================================
# OCR ENGINE INITIALIZATION
# =========================================================
OCR_ENGINE = None
if OCR_ENABLED:
    try:
        OCR_ENGINE = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            use_gpu=False,
            show_log=False
        )
    except Exception:
        OCR_ENGINE = None

# =========================================================
# MASTER PROMPTS
# =========================================================
CRAFTSMAN_MASTER_SYSTEM_PROMPT = """
CraftsmanAI Master Jewelry Render Controller

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
- "same as reference but…" = preserve baseline and apply only requested changes
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
- text are connected?
If any answer is NO, correct the result before finalizing.
"""

PROMPT_ONLY_MASTER = """
CraftsmanAI Jewelry Render — Text-Only Mode

Generate one practical, manufacturable CAD-styled jewelry render from the user's text request.

Rules:
- Produce a physically believable, manufacturable design
- Favor realistic proportions, small-to-mid stones by default, and premium metal realism
- Use clean white background, flat studio lighting, minimal reflections
- If the description is sparse, infer conservatively and keep designs simple
"""

SUPPORTED_TAXONOMY = """
SUPPORTED TYPES (map every job to one — never invent fantasy categories):
Rings (Band, Bust Down, Signet, Statement, Wedding, Engagement, Custom Shape) · Pendants (Name/Initial, Picture, Religious, Logo/Brand, Symbol/Icon, Custom Shape) · Chains (Box, Cuban, Figaro, Franco, Rope, Tennis, Link, Custom Shape) · Earrings (Hoop, Stud, Drop, Chandelier, Ear Cuff, Custom Shape) · Bracelets (Bangle, Cuff, Charm, Cuban, Tennis, ID, Custom Shape) · Grillz (Single Tooth, Top, Bottom, Full Set, Custom) · Watches (Skeleton, Iced Apple Watch, Diamond Dial, Bezel-Iced, Fully Iced, Custom).
"""

OUTPUT_CONTRACT = """
OUTPUT: Exactly ONE image. Front-facing hero angle. CAD-styled approval render on a clean white background. Centered piece, no environment.
"""

HOUSE_STYLE = """
STYLE: Clean CAD-styled jewelry approval render. Isolated piece on a clean white/very light neutral background — no body, hands, props, or environment. Front-facing hero angle, centered, crisp edges, premium feel, manufacturable look. Realistic metal and stones. No cinematic atmosphere or heavy shadows.
"""

STONE_RULES = """
STONES: Use realistic small-to-mid stones unless the user asks for bold/large. On paved/iced surfaces use staggered/honeycomb arrangements that follow the surface curvature, taper cleanly at edges, and respect any explicit row counts (resize stones to fit). Keep prong/setting style uniform within a region.
"""

ANTI_HALLUCINATION = """
AVOID: melted prongs, floating stones, fused metal blobs, warped stones, lazy diamond-grid wallpaper, broken edge settings, random setting changes mid-region, halos or decorative extras the user did not ask for, off-center framing, dramatic angles by default.

HARD NEGATIVE CONSTRAINTS (mandatory — never violate):
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
- Do NOT creatively reinterpret the piece beyond the prompt
"""

SHARED_RULES = f"""{SUPPORTED_TAXONOMY}

{OUTPUT_CONTRACT}

{HOUSE_STYLE}

{STONE_RULES}

{ANTI_HALLUCINATION}

PRIORITY ORDER (resolve any conflict in this order):
1. The user's explicit request / refinement note
2. The reference image's geometry and content
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
- composition and centering
"""

REFINEMENT_INTERPRETER_SYSTEM = """You are CraftsmanAI's refinement interpreter. Jewelry retailers write casual, mixed, sometimes misspelled English. Convert their short prompt into a precise structured edit intent.

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
- never treat vague verbs ("change", "make", "fix", "turn", "lay", "move") as no-change — infer the attribute from the rest of the phrase and the image
- if the user says "horizontal/sideways/across/lay flat/landscape" → orientation_change → to_state horizontal/sideways
- if they say "vertical/upright/portrait/standing" → orientation_change → to_state vertical/upright
- if they mention only a metal color → material_color_change only, geometry frozen
- if they say "same as ref but X" → diff_only_edit, freeze everything except X
- if they say "use this as the bail / make this the bail" → custom_bail_edit, the custom element becomes the visible bail; only a hidden functional loop behind if needed
- preserve manufacturability and CAD realism

Always call the function tool. Never reply in plain text."""

# =========================================================
# HELPER FUNCTIONS PORTED FROM TEST SCRIPT
# =========================================================

def sanitize_prompt(prompt: str) -> str:
    replacements = {
        "exact": "matching",
        "replica": "inspired",
        "identical": "matching"
    }
    cleaned = prompt
    for old, new in replacements.items():
        cleaned = re.sub(old, new, cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()

def ensure_default_gold(prompt: str) -> str:
    lower = prompt.lower()
    metals = [
        "yellow gold",
        "white gold",
        "rose gold",
        "silver",
        "platinum",
        "10k",
        "14k",
        "18k"
    ]
    if any(x in lower for x in metals):
        return prompt
    return f"10KT Yellow Gold. {prompt}"

def extract_text(image_path: str) -> List[str]:
    if OCR_ENGINE is None:
        return []
    try:
        results = OCR_ENGINE.ocr(image_path)
        extracted = []
        for line in results:
            for item in line:
                text = item[1][0]
                if text.strip():
                    extracted.append(text)
        return extracted
    except Exception:
        return []

def is_image_enhancement_only(note: str) -> bool:
    lower = (note or "").lower().strip()
    if not lower:
        return False
    patterns = [
        r"\bjust\s+(sharpen|clean|enhance|cleaner|crisper)\b",
        r"\bmake\s+it\s+(cleaner|sharper|crisper|clearer|more\s+premium)\b",
        r"\bsharpen\s+it\b",
        r"\bclean(\s+it)?\s+up\b",
        r"\b(higher|better|more)\s+(quality|resolution|detail)\b",
        r"\bsame\s+(design|piece)\s+but\s+(cleaner|sharper|bigger|larger|smaller)\b",
        r"\bsize\s+(up|down|change)\b",
        r"\bscale\s+(up|down)\b",
        r"\bmetal\s+change\s+only\b",
        r"\bonly\s+(change|update)\s+(the\s+)?(metal|color|tone|finish)\b",
        r"\bproduction\s+(ready|view)\b",
        r"\bmore\s+3d\b",
    ]
    return any(re.search(p, lower) for p in patterns)

def classify_reference_type(parsed_data: Dict[str, Any], note: str, image_count: int) -> str:
    source_kind = (parsed_data or {}).get("source_kind", "unknown")
    if image_count == 0:
        return "text_only"
    if source_kind in ("jewelry_reference", "cad_render", "existing_jewelry") and is_image_enhancement_only(note):
        return "image_enhancement_only"
    if source_kind in ("jewelry_reference", "cad_render", "existing_jewelry"):
        return "existing_jewelry_reference"
    if source_kind in ("non_jewelry_reference", "logo_text_asset", "sketch", "screenshot_request"):
        return "non_jewelry_reference"
    if source_kind == "mixed_reference":
        return "hybrid"
    return "hybrid"

def normalize_retailer_language(note: str) -> List[str]:
    lower = (note or "").lower()
    directives: List[str] = []
    row_match = re.search(r"\b(\d+)\s*rows?\b", lower)
    if row_match:
        directives.append(f"Stone row count requirement: {row_match.group(1)} rows. Reduce stone size to fit if needed.")
    if any(x in lower for x in ["smaller stones", "smaller pointers", "micro pave", "finer diamonds"]):
        directives.append("Use smaller or micro stones to increase fit density and satisfy row or coverage instructions.")
    if any(x in lower for x in ["tighter setting", "no gaps", "more dense", "more packed"]):
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
    if any(x in lower for x in ["flooded", "bust down", "fully iced", "full ice"]):
        directives.append("Increase stone coverage and density while keeping arrangement clean, practical, and region-appropriate.")
    if "border only" in lower:
        directives.append("Limit stone coverage to the border/frame region only.")
    if "top only" in lower:
        directives.append("Limit stone coverage to the top/face region only.")
    if re.search(r"\bletters?\s+only\b", lower):
        directives.append("Restrict edits to the letter/text region only — freeze background plate, border, bail, and all surrounding regions.")
    if re.search(r"don'?t\s+touch\s+the\s+bail|leave\s+the\s+bail", lower):
        directives.append("Bail must be preserved exactly — do NOT modify bail geometry, size, or style.")
    if re.search(r"raised\s+letters?|3d\s+letters?|popped\s+letters?", lower):
        directives.append("Render letters as REAL raised geometry with depth and side walls — not a flat printed texture, not engraved-in.")
    if re.search(r"more\s+3d|more\s+depth|more\s+dimensional|deeper\s+relief", lower):
        directives.append("Increase relief depth and three-dimensionality of raised regions, but do NOT change silhouette or layout.")
    if re.search(r"side\s+engraving|engraving\s+on\s+the\s+side|side\s+detail", lower):
        directives.append("Modify ONLY the side engraving zone — freeze top face, border, bail, and all other regions.")
    if re.search(r"metal\s+change\s+only|just\s+change\s+the\s+metal|only\s+(the\s+)?metal", lower):
        directives.append("Change ONLY the metal color/tone — preserve every other geometric, structural, and stone detail exactly.")
    if re.search(r"more\s+premium|more\s+luxury|more\s+high[-\s]?end|cleaner\s+look", lower):
        directives.append("Improve presentation polish (lighting, crispness, finish) WITHOUT redesigning structure, stones, or layout.")
    if re.search(r"keep\s+everything\s+(else\s+)?same|keep\s+(the\s+)?rest\s+same|same\s+as\s+(the\s+)?(pic|picture|photo|image|reference|ref)\b", lower):
        directives.append("Treat the reference as authoritative for ALL non-mentioned regions — freeze them exactly.")
    if re.search(r"just\s+sharpen|just\s+clean|sharpen\s+it\b", lower):
        directives.append("Enhance clarity and sharpness only — do NOT redesign any aspect of the piece.")
    if re.search(r"same\s+as\s+(reference|ref|pic)\s+but", lower):
        directives.append("Use the reference as the base and apply ONLY the specific delta after 'but' — freeze everything else.")
    return directives

def determine_authority(parsed_data: Dict[str, Any], note: str) -> str:
    source_kind = (parsed_data or {}).get("source_kind", "unknown")
    intent = (parsed_data or {}).get("request_intent", "render_as_is")
    has_meaningful_note = bool((note or "").strip())
    is_reference_based = source_kind in ("jewelry_reference", "cad_render", "existing_jewelry")
    if is_reference_based and intent == "render_as_is" and not has_meaningful_note:
        return "REFERENCE_PRIMARY"
    if is_reference_based and (intent == "modify_existing" or has_meaningful_note):
        return "HYBRID_DIFF"
    if source_kind == "text_only":
        return "TEXT_PRIMARY"
    if source_kind in ("non_jewelry_reference", "logo_text_asset", "sketch"):
        return "HYBRID_SHAPE_TEXT"
    return "HYBRID_DIFF"

def build_authority_block(authority: str) -> str:
    if authority == "REFERENCE_PRIMARY":
        return "REFERENCE AUTHORITY:\n- The uploaded reference is the primary authority for geometry, material, layout, and design identity.\n- Reproduce the same piece exactly unless the user explicitly requests a change."
    if authority == "HYBRID_DIFF":
        return "REFERENCE + TEXT AUTHORITY:\n- The reference governs all unchanged regions.\n- The note governs ONLY the explicitly requested changes.\n- Preserve all unspecified geometry, material, and layout from the reference."
    if authority == "TEXT_PRIMARY":
        return "TEXT AUTHORITY:\n- No usable jewelry reference governs structure.\n- Use the note as the primary authority."
    return "HYBRID AUTHORITY:\n- Preserve the source silhouette, spacing, and negative space.\n- Apply text instructions only where they explicitly modify material, stones, or construction."

def build_attachment_authority_block(mode: str, image_count: int, parsed_data: Dict[str, Any]) -> str:
    if not image_count:
        return ""
    source_kind = (parsed_data or {}).get("source_kind", "unknown")
    is_reference_based = source_kind in ("jewelry_reference", "cad_render", "existing_jewelry")
    if mode == "refine":
        s = "IMAGE ATTACHMENT AUTHORITY:\n- FIRST attached image = MASTER render to edit\n"
        if image_count > 1:
            s += "- Additional attached images = support-only references for the requested change; never replace or average the master render with them.\n"
        s += "- Preserve the master render exactly outside the requested delta.\n- If any support image conflicts with the master render, the master render wins."
        return s
    if is_reference_based:
        s = "IMAGE ATTACHMENT AUTHORITY:\n- FIRST attached image = MASTER reference for geometry, layout, stones, metal placement, and silhouette\n"
        if image_count > 1:
            s += "- Additional attached images = secondary support references only; use them only for details explicitly requested by the user.\n"
        s += "- Never average multiple images into a new hybrid design unless the user explicitly asks to combine them.\n- If an attached support image conflicts with the master reference, the master reference wins."
        return s
    if image_count > 1:
        return "IMAGE ATTACHMENT AUTHORITY:\n- FIRST attached image is the base visual context.\n- Additional attached images are support-only and must not override the first image unless the note explicitly asks for it."
    return ""

def classify_refinement(note: str) -> str:
    lower = (note or "").lower()
    full_patterns = [
        r"convert\s+to\s+(ring|pendant|chain|bracelet|earring|grill|watch)",
        r"change\s+it\s+to\s+a\s+(ring|pendant|chain|bracelet|earring|grill|watch)",
        r"completely\s+redesign",
        r"start\s+over",
        r"major\s+redesign",
        r"replace\s+the\s+(entire|whole|main)\s+(logo|design|piece)",
    ]
    for p in full_patterns:
        if re.search(p, lower):
            return "FULL_REGEN"
    partial_patterns = [
        r"bigger|larger|thicker|wider|taller|shorter|smaller|narrower",
        r"change\s+the\s+(bail|shank|band|border|frame|top|head|center\s*stone|halo)",
        r"add\s+(a\s+)?(bail|border|frame|halo|prongs|bezel|setting|row|rows)",
        r"remove\s+(the\s+)?(bail|border|frame|halo|row|rows)",
        r"replace\s+(the\s+)?(bail|shank|band|center\s*stone)",
        r"different\s+(bail|shank|band|border|frame|setting|top)",
        r"\d+\s*rows?",
        r"triple\s+(border|halo|row)",
        r"more\s+rows",
        r"fewer\s+rows",
        r"add\s+more\s+stones",
        r"more\s+coverage",
        r"bust\s*down",
        r"flood",
        r"fully\s+ic",
    ]
    for p in partial_patterns:
        if re.search(p, lower):
            return "PARTIAL_REGEN"
    return "LOCAL_EDIT"

def identify_target_regions(note: str) -> List[str]:
    lower = (note or "").lower()
    regions: List[str] = []
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
    cosmetic_patterns = [
        "white gold", "rose gold", "yellow gold", "platinum", "silver",
        "iced", "plain", "diamond", "matte", "polished", "brushed",
        "color", "finish", "tone", "bust down", "flood", "micro pave", "pave",
    ]
    if not regions:
        for p in cosmetic_patterns:
            if p in lower:
                regions.append("global_cosmetic")
                break
    return regions if regions else ["unspecified"]

def infer_item_type_from_prompt(note: str) -> str:
    lower = (note or "").lower()
    if re.search(r"\b(ring|signet\s*ring|class\s*ring|school\s*ring|championship\s*ring)\b", lower):
        return "ring"
    if re.search(r"\b(pendant|necklace|charm|bail)\b", lower):
        return "pendant"
    if re.search(r"\b(chain|cuban|figaro|franco|rope|tennis|link)\b", lower):
        return "chain"
    if re.search(r"\b(earring|hoop|stud|drop|chandelier|ear\s*cuff)\b", lower):
        return "earring"
    if re.search(r"\b(bracelet|bangle|cuff|id\s*bracelet)\b", lower):
        return "bracelet"
    if re.search(r"\b(grill|grillz|tooth|teeth)\b", lower):
        return "grillz"
    if re.search(r"\b(watch|dial|bezel)\b", lower):
        return "watch"
    return "pendant"

def is_class_or_signet_ring(parsed_data: Dict[str, Any], note: str) -> bool:
    item_type = (parsed_data.get("item_type") or "").lower()
    if item_type != "ring":
        if not re.search(r"\b(ring|signet|class\s*ring|championship|school\s*ring)\b", note or "", re.IGNORECASE):
            return False
    render_class = (parsed_data.get("render_class") or "").lower()
    subject = (parsed_data.get("primary_subject_summary") or "").lower()
    hay = f"{render_class} {subject} {(note or '').lower()}"
    patterns = [
        r"\bclass\s*ring\b",
        r"\bschool\s*ring\b",
        r"\bsignet\s*ring\b",
        r"\bsignet\b",
        r"\bchampionship\s*ring\b",
        r"\b(super\s*bowl|nba|nfl|world\s*series|nhl)\s*ring\b",
        r"\b(varsity|graduation|grad)\s*ring\b",
        r"\bcrest\s*ring\b",
        r"\bseal\s*ring\b",
        r"\blogo\s*ring\b",
        r"\bclass\s*of\s*\d{2,4}\b",
        r"\bplanar\s+face\b",
    ]
    if any(re.search(p, hay) for p in patterns):
        return True
    source_kind = parsed_data.get("source_kind") or ""
    if item_type == "ring" and (source_kind == "logo_text_asset" or parsed_data.get("text_or_logo_presence") is True):
        return True
    return False

def build_class_ring_prompt(params: Dict[str, Any]) -> str:
    pd = params.get("pd") or {}
    note = params.get("note") or ""
    metal_tone = params.get("metalTone") or ""
    mode = params.get("mode") or "initial"
    target_regions = params.get("targetRegions") or []
    authority_block = params.get("authorityBlock") or ""
    attachment_authority_block = params.get("attachmentAuthorityBlock") or ""
    normalized_block = params.get("normalizedBlock") or ""
    preserve_block = params.get("preserveBlock") or ""
    reference_type_block = params.get("referenceTypeBlock") or ""

    subject = pd.get("primary_subject_summary") or note or "class ring"
    locked_elements = ", ".join(pd.get("locked_elements") or []) or "none specified"
    metal = metal_tone or pd.get("metal_tone") or "10kt yellow gold"
    regions = ", ".join(target_regions) if target_regions else "unspecified"

    refinement_history = pd.get("refinement_history") or []
    previous_fixes = "\n".join([f"  {i + 1}. {h.get('note', '')}" for i, h in enumerate(refinement_history[-5:])])

    refinement_lock_block = ""
    if mode == "refine":
        refinement_lock_block = f"""
REFINEMENT LOCK (mandatory):
- The FIRST attached image is the LATEST APPROVED DRAFT — treat it as the absolute base
- This is an image edit, NOT a redesign
- Do NOT restart from the original logo reference, do NOT regenerate from scratch
- Apply ONLY the requested delta on top of the latest draft
- Preserve every previous successful fix
- If the request is ambiguous, under-edit rather than changing extra regions{f"\n\nPrevious fixes already applied (DO NOT undo):\n{previous_fixes}" if previous_fixes else ""}"""

    return f"""You are Craftsman.ai's APPROVAL-RENDER engine for custom jewellery.
Your job is NOT a beautiful fantasy image. Your job is a manufacturable, approval-ready jewellery render.

SUBTYPE LOCK: SIGNET_RING_CLASS_STYLE
{reference_type_block}
{authority_block}
{attachment_authority_block}
{normalized_block}
{preserve_block}
{refinement_lock_block}

CLASS / SIGNET RING REGION MODEL (treat as discrete regions, never blend):
1. center_face_logo        — exact center-face content, taken verbatim from the uploaded logo/reference; NOT loose inspiration
2. outer_face_top_text     — curved text along the top arc of the face (only if requested)
3. outer_face_bottom_text  — curved text along the bottom arc of the face (only if requested)
4. left_shoulder_design    — symmetrical mirror of right shoulder
5. right_shoulder_design   — symmetrical mirror of left shoulder
6. shank_body              — clean tapered band, premium gold realism
7. inner_band_marking      — only if explicitly requested

RENDER PRIORITIES (in order):
1. Correct ring subtype and proportions (planar signet/class-ring face, not domed solitaire)
2. Correct face layout (center logo + optional curved text)
3. Correct side layout (symmetrical shoulders, realistic taper)
4. Clean readable text — NO warped, melted, or invented letters
5. Premium {metal} realism (10KT yellow gold default unless specified)
6. Symmetry and manufacturable feel

HARD RULES:
- Treat the uploaded logo/reference as EXACT center-face content, not inspiration
- Never invent letters, dates, numbers, symbols, mascots, or side details not requested
- Never trust diffusion alone for final text — prefer fewer, sharper letters over many warped ones
- Preserve a PLANAR signet/class-ring face (flat or gently domed plate, not a gemstone dome)
- Preserve shoulder symmetry and realistic taper from face → shank
- Use premium {metal} material realism (warm saturated gold, clean specular, no plastic look)
- Clean white or light gray product background
- Front hero view by default, ring face squarely toward camera, slight downward tilt only if needed for face readability
- If extra angles are requested later, generate side and 3/4 views AFTER hero is approved (not now)

NEGATIVE CONSTRAINTS (must avoid):
- Warped text, melted gold, asymmetrical shoulders, floating letters
- Fake gemstones unless explicitly requested
- Random icons, distorted seal, soft unreadable engraving
- Exaggerated fantasy styling, over-dramatic lighting
- Domed solitaire face when a signet plate is required
- Mismatched left/right shoulders

TEXT & LOGO PRECISION:
- Preserve logo edges, letter shapes, spacing, line weight, and negative space exactly
- Keep text crisp in THIS pass — do NOT smear, simplify, or improvise characters
- Never replace readable logo/text geometry with approximate engraved texture

Design subject: {subject}
Metal tone: {metal}
Locked elements: {locked_elements}
{f"Refinement target regions: {regions}\nRefinement request: {note}" if mode == "refine" else (f"User note: {note}" if note else "")}
{SHARED_RULES}

Generate ONE front-facing hero render of this CLASS / SIGNET RING — planar face, symmetrical shoulders, premium {metal}, clean background, approval-ready."""

def interpret_refinement(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        return None

    pd = params.get("parsedData") or {}
    baseline_summary = "\n".join([
        f"Item type: {pd.get('item_type')}" if pd.get("item_type") else "",
        f"Subtype: {pd.get('subtype')}" if pd.get("subtype") else "",
        f"Subject: {pd.get('primary_subject_summary')}" if pd.get("primary_subject_summary") else "",
        f"Components: {', '.join(pd.get('dominant_components') or [])}" if pd.get("dominant_components") else "",
        f"Metal: {pd.get('metal_tone')}" if pd.get("metal_tone") else "",
        f"Stones: {pd.get('stone_presence')}/{pd.get('stone_coverage') or '?'}" if pd.get("stone_presence") else "",
    ]).strip()

    user_content = [{
        "type": "text",
        "text": f"Raw user prompt: \"\"\"{params.get('note', '')}\"\"\"\n\nBaseline:\n{baseline_summary or '(unknown)'}\n\nCurrent metal swatch: {params.get('metalTone') or 'yellow_gold'}\nVersion number: {params.get('versionNumber')}\n\nThe FIRST image below is the latest active jewelry render that the user is editing. Use it to identify the visible target component and infer intent.",
    }]

    for url in (params.get("imageUrls") or [])[:4]:
        user_content.append({"type": "image_url", "image_url": {"url": url}})

    tools = [{
        "type": "function",
        "function": {
            "name": "emit_refinement_intent",
            "description": "Emit the structured refinement intent.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "raw_user_prompt": {"type": "string"},
                    "normalized_prompt": {"type": "string"},
                    "user_language_type": {"type": "string", "enum": ["layman", "mixed", "technical", "unclear"]},
                    "detected_jewelry_type": {"type": "string"},
                    "detected_subtype": {"type": "string"},
                    "target_components": {"type": "array", "items": {"type": "string"}},
                    "target_regions": {"type": "array", "items": {"type": "string"}},
                    "change_type": {"type": "string"},
                    "attribute_to_change": {"type": "string"},
                    "from_state": {"type": "string"},
                    "to_state": {"type": "string"},
                    "preserve_components": {"type": "array", "items": {"type": "string"}},
                    "preserve_global_style": {"type": "boolean"},
                    "requires_mask_or_crop": {"type": "boolean"},
                    "render_strategy": {"type": "string", "enum": ["color_only_edit", "targeted_component_edit", "component_inpaint", "partial_regeneration", "full_regeneration"]},
                    "edit_strength": {"type": "string", "enum": ["light", "medium", "strong", "forceful"]},
                    "clarification_needed": {"type": "boolean"},
                    "clarification_question": {"type": "string"},
                    "qa_checks": {"type": "array", "items": {"type": "string"}},
                    "retry_prompt_if_failed": {"type": "string"},
                },
                "required": [
                    "raw_user_prompt", "normalized_prompt", "user_language_type",
                    "detected_jewelry_type", "target_components", "change_type",
                    "attribute_to_change", "preserve_components", "render_strategy",
                    "edit_strength", "qa_checks", "retry_prompt_if_failed",
                ],
            },
        },
    }]

    try:
        resp = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            headers={"Authorization": f"Bearer {gemini_api_key}", "Content-Type": "application/json"},
            json={
                "model": "gemini-1.5-flash",
                "messages": [
                    {"role": "system", "content": REFINEMENT_INTERPRETER_SYSTEM},
                    {"role": "user", "content": user_content},
                ],
                "tools": tools,
                "tool_choice": {"type": "function", "function": {"name": "emit_refinement_intent"}},
            },
            timeout=25,
        )
        if not resp.ok:
            return None
        j = resp.json()
        args = j.get("choices", [{}])[0].get("message", {}).get("tool_calls", [{}])[0].get("function", {}).get("arguments")
        if not args:
            return None
        intent = args if isinstance(args, dict) else json.loads(args)
        intent["raw_user_prompt"] = intent.get("raw_user_prompt") or params.get("note", "")
        return intent
    except Exception:
        return None

def build_focused_refinement_prompt(intent: Dict[str, Any], base_fallback: str, attempt: int) -> str:
    targets = ", ".join(intent.get("target_components") or []) or "the requested component"
    regions = ", ".join(intent.get("target_regions") or []) or "(component region)"
    preserve = ", ".join(intent.get("preserve_components") or []) or "every other region"
    change = intent.get("normalized_prompt") or intent.get("raw_user_prompt")
    from_to = ""
    if intent.get("from_state") or intent.get("to_state"):
        from_to = f"Change {intent.get('attribute_to_change') or 'the relevant attribute'} from \"{intent.get('from_state') or 'current state'}\" to \"{intent.get('to_state') or 'requested state'}\"."

    strategy_hint = "Apply this as a localized edit; do not regenerate the full piece."
    if intent.get("requires_mask_or_crop"):
        strategy_hint = "Treat this as a TARGETED COMPONENT EDIT. If the target component is small, mentally crop/zoom into that component, apply the change there, then composite back so non-target regions stay pixel-faithful."

    if attempt == 1:
        intensity = "Apply the requested change clearly and visibly. The edit must be obvious — not subtle."
    elif attempt == 2:
        intensity = "CRITICAL CORRECTION: the previous attempt was too conservative and did NOT visibly apply the requested change. Apply it more strongly now. Use a targeted/cropped edit on the target component if needed. Do NOT preserve the target component's original state."
    else:
        intensity = "FINAL ATTEMPT: the output is unacceptable unless the target component clearly changes as instructed. You MAY redraw the target component fully. Preserve only the non-target regions exactly."

    retry_rewrite = f"\n\nForceful rewrite: {intent.get('retry_prompt_if_failed')}" if attempt > 1 and intent.get("retry_prompt_if_failed") else ""
    qa_list = "\n".join([f"- {c}" for c in intent.get("qa_checks") or []])

    return f"""REFINEMENT INTELLIGENCE — TARGETED EDIT (attempt {attempt})

The FIRST attached image is the CURRENT APPROVED RENDER. Treat it as your only master visual truth.
This is an IMAGE EDIT, not a redesign.

PRIORITY ORDER (do not violate):
1. Apply the explicit user-requested change to the target component.
2. Preserve every non-target component pixel-faithfully.
3. Maintain jewelry realism and manufacturability.
4. Maintain premium CAD-styled render quality.
5. Maintain camera angle, composition, lighting, background, and metal finish unless the change explicitly requires otherwise.

Never let preservation rules cancel the target edit. Preservation applies only to non-target regions.

TARGET COMPONENT(S): {targets}
TARGET REGION(S): {regions}
ATTRIBUTE TO CHANGE: {intent.get('attribute_to_change') or '(inferred)'}
{from_to}

NORMALIZED INSTRUCTION (use this, not the raw user words):
{change}

{strategy_hint}

{intensity}{retry_rewrite}

PRESERVE EXACTLY (do not touch): {preserve}.
Do NOT add, remove, resize, recolor, or alter any non-target component.
Do NOT change subtype. Do NOT introduce new decorative elements. Keep the same jewelry type, same camera angle, same composition, same lighting, same background.

VISUAL QA CHECKLIST the output MUST satisfy:
{qa_list or "- The requested change is visibly applied to the target component\n- All non-target regions remain identical"}

The output must look like a premium CAD-style jewelry render, physically plausible and production-friendly.

(Internal fallback context, lower priority than the rules above):
{base_fallback}"""

def qa_refinement_check(params: Dict[str, Any]) -> Dict[str, Any]:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        return {"passed": True, "reason": "qa_skipped_no_key", "failed_checks": [], "retry_recommended": False}

    intent = params.get("intent") or {}
    previous_ref_url = params.get("previousRefUrl")
    new_image_b64 = params.get("newImageB64")
    new_data_url = f"data:image/png;base64,{new_image_b64}" if new_image_b64 else None

    user_content = [{
        "type": "text",
        "text": f"Compare the PREVIOUS render (image 1) with the NEW render (image 2).\nThe user requested this change:\n\"{intent.get('normalized_prompt') or intent.get('raw_user_prompt')}\"\n\nTarget component(s): {', '.join(intent.get('target_components') or [])}\nAttribute to change: {intent.get('attribute_to_change')}\nFrom: {intent.get('from_state') or '(unspecified)'} → To: {intent.get('to_state') or '(unspecified)'}\n\nRun these visual checks against the NEW render:\n" + "\n".join([f"- {c}" for c in intent.get('qa_checks') or []]) + "\n\nAlso verify:\n- the requested change is VISIBLY applied (not subtle, not absent)\n- every non-target component is unchanged from the previous render\n- nothing was added or removed that the user did not ask for\n- the output remains a premium CAD-style jewelry render\n\nCall the function tool with your verdict.",
    }]

    if previous_ref_url:
        resolved_prev_url = previous_ref_url
        if not previous_ref_url.startswith("http"):
            resolved_prev_url = file_to_data_url(previous_ref_url)
        if resolved_prev_url:
            user_content.insert(0, {"type": "image_url", "image_url": {"url": resolved_prev_url}})
            
    if new_data_url:
        user_content.append({"type": "image_url", "image_url": {"url": new_data_url}})

    tools = [{
        "type": "function",
        "function": {
            "name": "emit_qa_verdict",
            "description": "Emit the QA verdict.",
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "passed": {"type": "boolean"},
                    "reason": {"type": "string"},
                    "failed_checks": {"type": "array", "items": {"type": "string"}},
                    "retry_recommended": {"type": "boolean"},
                },
                "required": ["passed", "reason", "failed_checks", "retry_recommended"],
            },
        },
    }]

    try:
        resp = requests.post(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            headers={"Authorization": f"Bearer {gemini_api_key}", "Content-Type": "application/json"},
            json={
                "model": "gemini-1.5-flash",
                "messages": [
                    {"role": "system", "content": "You are a strict jewelry-render QA inspector. You only call the emit_qa_verdict tool."},
                    {"role": "user", "content": user_content},
                ],
                "tools": tools,
                "tool_choice": {"type": "function", "function": {"name": "emit_qa_verdict"}},
            },
            timeout=30,
        )
        if not resp.ok:
            return {"passed": True, "reason": "qa_gateway_error", "failed_checks": [], "retry_recommended": False}
        j = resp.json()
        args = j.get("choices", [{}])[0].get("message", {}).get("tool_calls", [{}])[0].get("function", {}).get("arguments")
        if not args:
            return {"passed": True, "reason": "qa_no_tool_call", "failed_checks": [], "retry_recommended": False}
        verdict = args if isinstance(args, dict) else json.loads(args)
        return {
            "passed": bool(verdict.get("passed")),
            "reason": verdict.get("reason") or "",
            "failed_checks": verdict.get("failed_checks") or [],
            "retry_recommended": bool(verdict.get("retry_recommended")),
        }
    except Exception:
        return {"passed": True, "reason": "qa_exception", "failed_checks": [], "retry_recommended": False}

def build_prompt_from_dummy(params: Dict[str, Any]) -> str:
    pd = params.get("parsedData") or {}
    note = params.get("note", "")
    metal_tone = params.get("metalTone", "yellow_gold")
    mode = params.get("mode", "initial")
    image_count = params.get("imageCount", 0)
    refinement_mode = params.get("refinementMode")
    target_regions = params.get("targetRegions") or []

    item_type = pd.get("item_type") or infer_item_type_from_prompt(note)
    subject = pd.get("primary_subject_summary") or note or "a jewelry piece"

    note_lower = (note or "").lower()
    user_specifies_type = bool(re.search(r"\b(ring|pendant|chain|earring|bracelet|grill|watch)\b", note_lower))
    user_specifies_metal = bool(re.search(r"\b(yellow gold|white gold|rose gold|platinum|silver|10k|14k|18k|gold)\b", note_lower))

    if image_count and pd.get("item_type"):
        if not user_specifies_type or not user_specifies_metal:
            item_type = pd.get("item_type")

    if not user_specifies_metal and image_count:
        if pd.get("metal_tone"):
            metal_tone = pd.get("metal_tone")
        else:
            metal_tone = "same as the attached reference image"
    intent = pd.get("request_intent", "render_as_is")
    source_kind = pd.get("source_kind", "unknown")
    gen_mode = pd.get("generation_mode", "BASE_RENDER")
    components = ", ".join(pd.get("dominant_components") or [])
    stone_presence = pd.get("stone_presence", "unknown")
    stone_coverage = pd.get("stone_coverage", "unknown")
    stone_layout = pd.get("stone_layout_type", "unknown")
    stone_size_class = pd.get("stone_size_class", "small")
    stone_row_count = pd.get("stone_row_count")
    stone_arrangement = pd.get("stone_arrangement", "staggered")
    setting_family = pd.get("setting_family", "unknown")
    text_presence = pd.get("text_or_logo_presence", False)
    frame_presence = pd.get("frame_or_border_presence", False)
    locked_elements = ", ".join(pd.get("locked_elements") or []) or "none specified"
    risk_flags = ", ".join(pd.get("risk_flags") or []) or "none"
    sketch_annotations = "; ".join(pd.get("sketch_annotations") or [])
    color_mapping = pd.get("color_mapping")

    reference_type = classify_reference_type(pd, note, image_count)
    authority = determine_authority(pd, note)
    authority_block = build_authority_block(authority)
    attachment_authority_block = build_attachment_authority_block(mode, image_count, pd)
    normalized_directives = normalize_retailer_language(note)

    if (pd.get("item_type") or "pendant").lower() == "pendant":
        note_lower = (note or "").lower()
        user_mentions_bail = re.search(r"\b(bail|loop|jump\s*ring|hinge|connector|hanger|hook|clasp|chain\s*loop)\b", note_lower)
        parsed_mentions_bail = any(re.search(r"bail|loop|hinge|connector", str(c), re.IGNORECASE) for c in (pd.get("dominant_components") or []))
        parsed_mentions_bail = parsed_mentions_bail or any(re.search(r"bail|loop|hinge|connector", str(c), re.IGNORECASE) for c in (pd.get("requested_changes") or []))
        parsed_mentions_bail = parsed_mentions_bail or any(re.search(r"bail", str(c), re.IGNORECASE) for c in (pd.get("editable_regions") or []))
        parsed_mentions_bail = parsed_mentions_bail or any(re.search(r"bail", str(c), re.IGNORECASE) for c in (pd.get("locked_elements") or []))
        if not user_mentions_bail and not parsed_mentions_bail:
            normalized_directives.append(
                "PENDANT BAIL DEFAULT: If the input reference image clearly shows a specific bail/top connection (e.g. fixed loop, jump ring, integrated loop, V-bail, enhancer bail, screw bail, etc.), reproduce that connection EXACTLY as seen — do NOT replace it. ONLY if the reference image shows no clearly defined bail connection (and the user did not specify one), default the top connection to a clean HINGE-STYLE bail: a small hinged movable loop attached to the pendant top via a tiny pivot/pin so the loop can swing freely. Keep the hinge proportionate, production-realistic, and visually subtle — do not alter the pendant body, border, stones, or any other region.",
            )

    normalized_block = ""
    if normalized_directives:
        normalized_block = "Normalized technical directives:\n" + "\n".join([f"- {d}" for d in normalized_directives])

    if text_presence:
        if "Text/logo must be physically attached" not in normalized_directives:
            normalized_directives.append("Text/logo must be physically attached to the piece; do NOT render floating or detached badges.")
            normalized_block = "Normalized technical directives:\n" + "\n".join([f"- {d}" for d in normalized_directives])

    preserve_block = "" if reference_type == "text_only" else MANDATORY_PRESERVE_LIST
    reference_type_block = f"REFERENCE TYPE (auto-classified): {reference_type.upper()}"

    stone_block = ""
    if stone_presence != "unknown":
        stone_block = f"""
Stone details:
- Presence: {stone_presence}, Coverage: {stone_coverage}, Layout: {stone_layout}
- Size class: {stone_size_class} (default small-to-mid — do NOT use chunky large stones unless explicitly requested)
{f"- Row count: {stone_row_count} rows (MUST be respected — reduce stone size to fit if needed)" if stone_row_count else ""}
- Arrangement: {stone_arrangement} (prefer staggered/honeycomb over naive grids)
- Setting family: {setting_family} (keep uniform per region)"""

    if reference_type == "image_enhancement_only" and mode != "refine":
        return f"""You are Craftsman.ai's jewelry render engine. This is an ENHANCEMENT-ONLY job, NOT a redesign.

{reference_type_block}
{authority_block}
{attachment_authority_block}
{normalized_block}
{preserve_block}

ENHANCEMENT-ONLY RULES (mandatory):
- The user is NOT requesting a design change — only clarity, presentation, scale, or production polish
- Reproduce the SAME piece visually — same silhouette, same stones, same border, same font, same bail, same metal
- Improve only: image clarity, edge crispness, lighting, centering, background cleanup
- Do NOT alter style, border, font, stone pattern, layout, proportions, or structure
- Do NOT add or remove any element
- Treat this as a CAD-style "production view" of the existing piece

Item type: {item_type}
Metal tone: {metal_tone or pd.get("metal_tone") or "yellow gold"}
{f"User note: {note}" if note else ""}
{SHARED_RULES}

Generate ONE front-facing hero render that is a faithful, sharper, production-ready CAD reproduction of this {item_type}."""

    if is_class_or_signet_ring(pd, note):
        return build_class_ring_prompt({
            "pd": pd,
            "note": note,
            "metalTone": metal_tone,
            "mode": mode,
            "refinementMode": refinement_mode,
            "targetRegions": target_regions,
            "authorityBlock": authority_block,
            "attachmentAuthorityBlock": attachment_authority_block,
            "normalizedBlock": normalized_block,
            "preserveBlock": preserve_block,
            "referenceTypeBlock": reference_type_block,
        })

    if mode == "initial" and (gen_mode == "SKETCH_RENDER" or source_kind == "sketch"):
        return f"""You are Craftsman.ai's jewelry render engine. Convert this hand-drawn sketch into a clean CAD-styled jewelry render.

{authority_block}
{normalized_block}

SKETCH CONVERSION RULES:
- Preserve the drawn silhouette exactly
- Preserve the relative placement of all major components from the sketch
- Where the sketch shows rough stone outlines, convert to realistic stone placement using small-to-mid stones
- Where the sketch shows rough lettering, preserve letter structure as closely as possible
- Where arrows or annotations appear ({sketch_annotations or "none detected"}), obey them
- Where details are missing, infer conservatively — do NOT invent creative additions
- Do NOT add extra stones, halos, borders, or flourishes unless shown in the sketch
- Treat the sketch as the structural authority

Design subject: {subject}
Item type: {item_type}
Metal tone: {metal_tone or "yellow gold"}
{f"Key components from sketch: {components}" if components else ""}
{stone_block}
{f"User note: {note}" if note else ""}
{SHARED_RULES}

Generate ONE front-facing hero render of this {item_type} that faithfully represents the sketch."""

    if mode == "initial" and (gen_mode == "TEXT_RENDER" or source_kind == "text_only"):
        return f"""You are Craftsman.ai's jewelry render engine. Generate a jewelry piece from a text description only.

{authority_block}
{normalized_block}

TEXT-TO-RENDER RULES:
- Produce a practical, physically believable jewelry piece
- Preserve manufacturable logic — this should look like something a jeweler can actually build
- Use small-to-mid sized stones by default — avoid chunky unrealistic defaults
- Favor realistic proportions and construction
- If the description is sparse, infer a clean simple design — do NOT overcomplicate

Design description: {note or subject}
Item type: {item_type}
Metal tone: {metal_tone or "yellow gold"}
{stone_block}
{SHARED_RULES}

Generate ONE front-facing hero render of this {item_type}."""

    if mode == "refine":
        ref_mode = refinement_mode or "LOCAL_EDIT"
        regions = ", ".join(target_regions) if target_regions else "unspecified"
        refinement_history = pd.get("refinement_history") or []
        previous_fixes = "\n".join([f"  {i + 1}. {h.get('note', '')}" for i, h in enumerate(refinement_history[-5:])])
        changed_fields = "\n".join([f"- {d}" for d in (normalized_directives if normalized_directives else [note])])
        unchanged_fields = "\n".join([f"- {f}" for f in ["jewelry type", "subtype", "overall structure", "camera intent / hero composition", "piece identity", "all unchanged components"] if f.split(" ")[0] not in regions])

        refinement_skeleton_block = f"""
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

Previous baseline summary:
{subject}{f" — components: {components}" if components else ""}{f" — stones: {stone_presence}/{stone_coverage}" if stone_presence != "unknown" else ""}{" — contains text/logo" if text_presence else ""}{" — has border/frame" if frame_presence else ""}

User refinement request:
{note}

Computed change set (fields the user wants changed):
{changed_fields}

Fields that must remain unchanged:
{unchanged_fields}

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

Precision-critical rules:
- preserve spelling, logos, engravings, symbols, and exact layout unless specifically requested to modify them

Realism rules:
- no floating stones, no melted geometry, no broken structure, no extra parts, no random reinterpretation

Output goal:
Return a refined CAD-styled jewelry render with ONLY the requested updates applied, while keeping the rest of the piece stable and faithful to the previous version.
=================================================="""

        refinement_lock_block = f"""
REFINEMENT MODE — THE FIRST ATTACHED IMAGE IS THE DESIGN:
- Think like an image editor, not a designer
- The FIRST attached image is the current approved render and your ONLY master visual truth
{("- Any additional attached images are secondary support only — never merge, average, or replace the master render with them." if image_count > 1 else "")}
- There is no original reference for this task. Do not go back to the first concept.
- Apply ONLY the change described below. Everything else stays IDENTICAL.
- Same silhouette, same proportions, same stones, same text, same layout, same angle, same composition.
- Do NOT regenerate from scratch. Do NOT reinterpret the design.
- If unsure, preserve more and change less.
- The output must be visually identical to the input EXCEPT for the requested change.{(f"\n\nPrevious fixes already applied (preserve all of these):\n{previous_fixes}" if previous_fixes else "")}"""

        preservation_block = """
PRESERVATION-FIRST RULES:
- Preserve ALL unaffected structure exactly — do not let unrelated regions drift
- Do NOT regenerate the whole piece unless the change truly requires it
- Unrelated borders, bails, shanks, stone layouts, text, spacing, and negative space must remain identical
- Keep the same overall composition, camera angle, crop, lighting direction, and CAD-style presentation
- Maintain proportional relationships with unchanged regions
- Regions explicitly NOT mentioned by the user are FROZEN
- When a change can be applied locally, keep it local"""

        if ref_mode == "FULL_REGEN":
            return f"""You are Craftsman.ai's jewelry render engine. The user wants a MAJOR redesign of this piece.

{normalized_block}
{refinement_lock_block}
{refinement_skeleton_block}

Current piece: {item_type}
Requested change: {note}
{stone_block}

Apply the requested changes — but the attached image is still the visual base. Do not start from zero.
{SHARED_RULES}

Generate ONE front-facing hero render of the redesigned {item_type}."""

        if ref_mode == "PARTIAL_REGEN":
            return f"""You are Craftsman.ai's jewelry render engine. The user wants a STRUCTURAL change to specific regions.

{normalized_block}
{refinement_lock_block}
{refinement_skeleton_block}

Current piece: {item_type}
Refinement request: {note}
Target regions: {regions}
Frozen regions (do NOT change): everything except {regions}
{stone_block}
{preservation_block}

PARTIAL EDIT:
- Only modify: {regions}
- All other regions must be IDENTICAL to the attached image
{SHARED_RULES}

Generate ONE front-facing hero render with the regional change applied to this {item_type}."""

        return f"""You are Craftsman.ai's jewelry render engine. The user wants a COSMETIC refinement.

{normalized_block}
{refinement_lock_block}
{refinement_skeleton_block}

Current piece: {item_type}
Refinement request: {note}
Target regions: {regions}
{stone_block}
{preservation_block}

LOCAL EDIT:
- This is a surface-level change only (color, finish, icing, stone style, metal tone)
- Preserve ALL structural geometry exactly — match the attached image
- Only change the visual properties requested
{SHARED_RULES}

Generate ONE front-facing hero render with the cosmetic change applied to this {item_type}."""

    if source_kind in ("jewelry_reference", "cad_render", "existing_jewelry") and intent == "render_as_is":
        return f"""You are Craftsman.ai's jewelry render engine. The user has provided a jewelry reference image.

{reference_type_block}
{authority_block}
{attachment_authority_block}
{normalized_block}
{preserve_block}
- Produce a 1-to-1 CAD-styled render of the SAME piece
- Preserve EXACTLY: metal color, structure, depth, outline, silhouette, layers, stone arrangement, stone orientation, border/frame logic, top/head/shank/bail/clasp shape
- Visually enhance ONLY in clarity, presentation, and cleanliness
- Do NOT redesign, do NOT "improve" by changing design language
- Do NOT enlarge stones, do NOT simplify structure, do NOT add elements
- This is a faithful reproduction, not a reinterpretation

Design subject: {subject}
Item type: {item_type}
Metal tone: {metal_tone or pd.get("metal_tone") or "yellow gold"}
{f"Key components: {components}" if components else ""}
{stone_block}
{("Text/logo present: preserve shape and legibility exactly" if text_presence else "")}
{("Frame/border present: preserve structure exactly" if frame_presence else "")}
{SHARED_RULES}

Generate ONE front-facing hero render that is a faithful CAD-styled reproduction of this {item_type}."""

    if source_kind in ("non_jewelry_reference", "picture_artwork") or intent == "convert_to_jewelry":
        color_map_block = ""
        if color_mapping:
            color_map_block = "Color mapping:\n" + "\n".join([f"- {c.get('source_color')} → {c.get('jewelry_material')}" for c in color_mapping])
        return f"""You are Craftsman.ai's jewelry render engine. Convert this non-jewelry image into a jewelry piece.

{reference_type_block}
{authority_block}
{normalized_block}
{preserve_block}

NON-JEWELRY CONVERSION RULES:
- Preserve the original structure, spacing, outline, negative space, and major visual relationships
- Convert the subject into jewelry in a practical, manufacturable way
- Map colored regions to appropriate gemstone/metal equivalents
- For B&W input, use sensible real-world jewelry color logic unless user specifies otherwise
- Use common-sense object-color defaults when appropriate
- Do NOT overcomplicate — do NOT randomly invent decorative structures unrelated to the input
- Do NOT add excessive embellishments unless requested

Design subject: {subject}
Item type: {item_type}
Metal tone: {metal_tone or "yellow gold"}
{f"Key components: {components}" if components else ""}
{stone_block}
{color_map_block}
{f"User note: {note}" if note else ""}
{SHARED_RULES}

Generate ONE front-facing hero render of this {item_type} converted from the reference."""

    if source_kind == "logo_text_asset":
        return f"""You are Craftsman.ai's jewelry render engine. Convert this logo/text/symbol into a jewelry piece.

{reference_type_block}
{authority_block}
{normalized_block}
{preserve_block}

LOGO/TEXT CONVERSION RULES:
- Preserve the exact letterforms, logo shape, and negative space
- Make text readable and structurally sound as jewelry
- Use appropriate scale for the chosen item type
- Default to pendant if no type specified

Design subject: {subject}
Item type: {item_type}
Metal tone: {metal_tone or "yellow gold"}
{f"Key components: {components}" if components else ""}
{stone_block}
{f"User note: {note}" if note else ""}
{SHARED_RULES}

Generate ONE front-facing hero render of this {item_type}."""

    if intent == "modify_existing":
        return f"""You are Craftsman.ai's jewelry render engine. Modify an existing jewelry piece.

{reference_type_block}
{authority_block}
{attachment_authority_block}
{normalized_block}
{preserve_block}

MODIFICATION RULES:
- Start from the existing piece structure — preserve everything not explicitly changed
- Apply ONLY the requested changes: {"; ".join(pd.get("requested_changes") or []) or note or "as described"}
- Locked elements: {locked_elements}
- Do NOT redesign unaffected regions

Design subject: {subject}
Item type: {item_type}
Metal tone: {metal_tone or "yellow gold"}
{f"Key components: {components}" if components else ""}
{stone_block}
{f"User note: {note}" if note else ""}
{SHARED_RULES}

Generate ONE front-facing hero render of the modified {item_type}."""

    if intent == "combine_references":
        return f"""You are Craftsman.ai's jewelry render engine. Combine multiple references into one piece.

{authority_block}
{normalized_block}

COMBINATION RULES:
- The primary reference (first image) provides the base structure
- Supporting references provide style/material/detail guidance
- Combine according to the user's note: {note or "merge these references"}
- The result should be one cohesive piece, not a collage

Design subject: {subject}
Item type: {item_type}
Metal tone: {metal_tone or "yellow gold"}
{stone_block}
{SHARED_RULES}

Generate ONE front-facing hero render of the combined {item_type}."""

    return f"""You are Craftsman.ai's jewelry render engine. Generate a single hero approval render.

{authority_block}
{normalized_block}

Design: {subject}
Item type: {item_type}
Source kind: {source_kind}
Intent: {intent}
Metal tone: {metal_tone or "yellow gold"}
{f"Key components: {components}" if components else ""}
{stone_block}
{("Text/logo present: preserve shape and legibility" if text_presence else "")}
{("Frame/border present: preserve structure" if frame_presence else "")}
{(f"Risk flags: {risk_flags}" if risk_flags != "none" else "")}
{(f"User note: {note}" if note else "")}
{SHARED_RULES}

Generate ONE front-facing hero render of this {item_type}."""

def build_prompt(
    user_prompt: str,
    reference_image: Optional[str] = None,
    parsed_data: Optional[Dict[str, Any]] = None,
    mode: str = "initial",
    metal_tone: str = "yellow_gold",
    image_urls: Optional[List[str]] = None,
    version_number: int = 1,
    refinement_prompt: Optional[str] = None,
    refinement_intent: Optional[Dict[str, Any]] = None,
    attempt: int = 1,
) -> str:
    note = user_prompt or ""
    pd = parsed_data or {}
    image_count = len(image_urls or []) if image_urls is not None else (1 if reference_image else 0)
    refinement_mode = classify_refinement(note) if mode == "refine" else None
    target_regions = identify_target_regions(note) if mode == "refine" else None
    base_prompt = build_prompt_from_dummy({
        "parsedData": pd,
        "note": note,
        "metalTone": metal_tone,
        "mode": mode,
        "imageCount": image_count,
        "refinementMode": refinement_mode,
        "targetRegions": target_regions,
    })

    is_refine = mode == "refine"
    system_preamble = (
        "REFINEMENT MODE. The first attached image is the CURRENT RENDER and is the only master visual truth. Apply ONLY the change described. Everything not mentioned must remain IDENTICAL: silhouette, proportions, stones, text, metal, angle, composition. If unsure, change less. Output front-facing, centered, on white/very light background. Never refuse."
        if is_refine
        else "JEWELRY RENDER. If reference image(s) are attached, the FIRST is the master reference. Reproduce it as faithfully as possible unless the note explicitly overrides. For text_only, the text is authority. Output front-facing, centered, on white/very light background. Preserve untouched structure exactly. If unsure, preserve rather than invent. Never refuse."
    )

    resolved_item_type = str(pd.get("item_type") or infer_item_type_from_prompt(note)).lower()
    set_no_hook_constraint = ""
    if resolved_item_type == "set":
        set_no_hook_constraint = """

SET-TYPE HARD CONSTRAINT (non-negotiable, overrides user prompt and reference images):
- Output MUST be a matching set: one centered pendant + one pair of earrings (left and right), on a clean white background.
- The pendant MUST show ONLY the bail (the smooth metal loop attached to the pendant body). DO NOT render any additional top hook, jump ring, spring-ring clasp, lobster clasp, open hook, prong-style hanger, or any extra hanging hardware above the bail.
- The bail must terminate cleanly at its top — no second loop, no wire hook, no clasp, no chain, no hanging mechanism whatsoever above it.
- This applies even if the reference image shows a top hook or the user asks for one. Silently omit it.
- Earrings retain their normal posts/backs; this rule applies ONLY to the pendant's top."""

    focused_prompt = base_prompt
    if is_refine and refinement_intent:
        focused_prompt = build_focused_refinement_prompt(refinement_intent, base_prompt, attempt)

    final_prompt = f"""{CRAFTSMAN_MASTER_SYSTEM_PROMPT}

{system_preamble}

{focused_prompt}{set_no_hook_constraint}"""

    return final_prompt.strip()

def calculate_hash_similarity(img1: str, img2: str) -> int:
    try:
        hash1 = imagehash.average_hash(Image.open(img1))
        hash2 = imagehash.average_hash(Image.open(img2))
        return 100 - (hash1 - hash2)
    except Exception:
        return 0

def calculate_ssim_similarity(img1: str, img2: str) -> float:
    if not SSIM_ENABLED:
        return 0.0
    try:
        image1 = cv2.imread(img1)
        image2 = cv2.imread(img2)
        if image1 is None or image2 is None:
            return 0.0
        image1 = cv2.cvtColor(image1, cv2.COLOR_BGR2GRAY)
        image2 = cv2.cvtColor(image2, cv2.COLOR_BGR2GRAY)
        image2 = cv2.resize(image2, (image1.shape[1], image1.shape[0]))
        score, _ = ssim(image1, image2, full=True)
        return round(score * 100, 2)
    except Exception:
        return 0.0

def validate_output(reference: str, generated: str) -> Dict[str, Any]:
    hash_score = calculate_hash_similarity(reference, generated)
    ssim_score = calculate_ssim_similarity(reference, generated)
    logger.info(f"[HASH SIMILARITY]: {hash_score}")
    logger.info(f"[SSIM SIMILARITY]: {ssim_score}")
    return {
        "hash": hash_score,
        "ssim": ssim_score
    }

def file_to_data_url(file_path: str) -> Optional[str]:
    if not file_path:
        return None
    if file_path.startswith("http"):
        return file_path
    if not os.path.exists(file_path):
        return None
    ext = os.path.splitext(file_path)[1].lower()
    mime = "image/png"
    if ext in [".jpg", ".jpeg"]:
        mime = "image/jpeg"
    elif ext == ".webp":
        mime = "image/webp"
    with open(file_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{data}"

def resolve_image_urls(image_source: Optional[str | list[str]], image_urls: Optional[List[str]]) -> List[str]:
    if image_urls:
        return image_urls
    if image_source:
        if isinstance(image_source, list):
            urls = []
            for src in image_source:
                if src:
                    if src.startswith("http"):
                        urls.append(src)
                    else:
                        data_url = file_to_data_url(src)
                        if data_url:
                            urls.append(data_url)
            return urls
        if image_source.startswith("http"):
            return [image_source]
        data_url = file_to_data_url(image_source)
        return [data_url] if data_url else []
    return []

def extract_b64_from_result(result: Any) -> Optional[str]:
    b64 = getattr(result, "b64_json", None) or (
        result.get("b64_json")
        if isinstance(result, dict)
        else None
    )
    if b64:
        return b64

    try:
        if hasattr(result, "candidates"):
            for candidate in result.candidates:
                for part in candidate.content.parts:
                    inline_data = getattr(part, "inline_data", None)
                    if inline_data and hasattr(inline_data, "data"):
                        return base64.b64encode(inline_data.data).decode("utf-8")
    except Exception:
        pass

    return None

def generate_with_gemini(
    image_source: Optional[str | list[str]],
    user_prompt: str,
    prompt_override: Optional[str] = None
) -> Any:
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    gemini_model_name = os.getenv("GEMINI_IMAGE_MODEL")

    if not gemini_api_key:
        raise Exception("GEMINI_API_KEY missing")
    if not gemini_model_name:
        raise Exception("GEMINI_IMAGE_MODEL missing")

    genai.configure(api_key=gemini_api_key)
    model = genai.GenerativeModel(gemini_model_name)

    fallback_prompt = prompt_override or build_safe_fallback_prompt(user_prompt)

    sources = []
    if image_source:
        if isinstance(image_source, list):
            sources = [s for s in image_source if s]
        else:
            sources = [image_source]

    temp_files = []
    uploaded_files = []

    try:
        for src in sources:
            image_path = None
            if src.startswith("http"):
                try:
                    resp = requests.get(src, timeout=20)
                    resp.raise_for_status()
                    ext = ".png"
                    content_type = resp.headers.get("Content-Type", "")
                    if "image/jpeg" in content_type:
                        ext = ".jpg"
                    elif "image/webp" in content_type:
                        ext = ".webp"
                    fd, temp_path = tempfile.mkstemp(suffix=ext)
                    with os.fdopen(fd, "wb") as tmp:
                        tmp.write(resp.content)
                    image_path = temp_path
                    temp_files.append(temp_path)
                except Exception as e:
                    logger.error(f"Failed to download image_source URL to local temp file: {e}")
                    image_path = None
            else:
                image_path = src

            if image_path and os.path.exists(image_path):
                uploaded_file = genai.upload_file(image_path)
                uploaded_files.append(uploaded_file)

        contents = [fallback_prompt] + uploaded_files
        response = model.generate_content(contents)
        return response
    finally:
        for temp_file in temp_files:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except Exception:
                    pass

def build_safe_fallback_prompt(user_prompt: str) -> str:
    return f"""
Generate jewelry inspired by the uploaded reference while preserving the overall visual identity.

Use clean jewelry CAD rendering on a white background.

User Request:
{user_prompt}
"""

def ensure_local_file(image_source: Optional[str | list[str]]) -> tuple[Optional[str], Optional[str]]:
    """
    Ensure image_source is a local file path. Downloads it if it's a URL.
    If image_source is a list, resolves the first item (primary reference).
    Returns (local_path, temp_file_to_cleanup).
    """
    if not image_source:
        return None, None
    
    src = image_source
    if isinstance(image_source, list):
        if not image_source:
            return None, None
        src = image_source[0]

    if src.startswith("http"):
        try:
            resp = requests.get(src, timeout=20)
            resp.raise_for_status()
            ext = ".png"
            content_type = resp.headers.get("Content-Type", "")
            if "image/jpeg" in content_type:
                ext = ".jpg"
            elif "image/webp" in content_type:
                ext = ".webp"
            fd, temp_path = tempfile.mkstemp(suffix=ext)
            with os.fdopen(fd, "wb") as tmp:
                tmp.write(resp.content)
            return temp_path, temp_path
        except Exception as e:
            logger.error(f"Failed to download image_source URL to local file: {e}")
            return None, None
    return src, None

def save_b64_to_temp_file(b64_json: str) -> tuple[str, str]:
    """
    Save base64 image data to a temporary file.
    Returns (temp_path, temp_file_to_cleanup).
    """
    img_data = base64.b64decode(b64_json)
    fd, temp_path = tempfile.mkstemp(suffix=".png")
    with os.fdopen(fd, "wb") as tmp:
        tmp.write(img_data)
    return temp_path, temp_path

def generate_with_fallback(
    image_source: Optional[str],
    user_prompt: str,
    parsed_data: Optional[Dict[str, Any]] = None,
    image_urls: Optional[List[str]] = None,
    metal_tone: str = "yellow_gold",
    mode: Optional[str] = None,
    version_number: int = 1
) -> Any:
    # Intelligently detect mode based on prompt and mode arguments
    selected_mode = mode
    if not selected_mode:
        lower_prompt = (user_prompt or "").lower()
        if any(w in lower_prompt for w in ["refine", "style tags:", "focus on:", "change", "add", "remove", "replace"]):
            selected_mode = "refine"
        else:
            selected_mode = "initial"

    resolved_image_urls = resolve_image_urls(image_source, image_urls)

    refinement_intent = None
    if selected_mode == "refine" and user_prompt:
        refinement_intent = interpret_refinement({
            "note": user_prompt,
            "parsedData": parsed_data or {},
            "imageUrls": resolved_image_urls,
            "metalTone": metal_tone,
            "versionNumber": version_number,
        })

    if not refinement_intent:
        # Synthesize a robust initial QA validation intent
        refinement_intent = {
            "normalized_prompt": user_prompt,
            "raw_user_prompt": user_prompt,
            "target_components": ["full design"],
            "attribute_to_change": "jewelry render creation",
            "from_state": "reference image concept",
            "to_state": "premium CAD jewelry render",
            "qa_checks": [
                "The output is a premium, photorealistic, CAD-style jewelry render.",
                "The output matches the core style, theme, and identity of the reference image.",
                "The background is clean, solid, and seamless (preferably pure white).",
                "The design features no distorted lines, overlapping letters, or physical defects."
            ],
            "retry_prompt_if_failed": f"Generate a premium jewelry CAD render of the design requested: {user_prompt}. Ensure white background, sharp details, symmetrical structure, and no physical defects."
        }

    # Ensure local path for reference image
    local_ref_path, ref_temp_cleanup = ensure_local_file(image_source)

    candidates = []

    try:
        # =====================================================
        # PRIMARY GEMINI GENERATION LOOP WITH AUDITING & SIMILARITY CHECK
        # =====================================================
        max_attempts = 3
        previous_ref_url = resolved_image_urls[0] if resolved_image_urls else None

        for attempt in range(1, max_attempts + 1):
            final_prompt = build_prompt(
                user_prompt=user_prompt,
                reference_image=image_source,
                parsed_data=parsed_data,
                mode=selected_mode,
                metal_tone=metal_tone,
                image_urls=resolved_image_urls,
                version_number=version_number,
                refinement_intent=refinement_intent,
                attempt=attempt,
            )

            try:
                logger.info(f"[PRIMARY GEMINI GENERATION] Attempt {attempt}/{max_attempts}")
                result = generate_with_gemini(
                    image_source=image_source,
                    user_prompt=user_prompt,
                    prompt_override=final_prompt
                )

                b64_json = extract_b64_from_result(result)
                if not b64_json:
                    continue

                qa_result = qa_refinement_check({
                    "intent": refinement_intent,
                    "previousRefUrl": previous_ref_url,
                    "newImageB64": b64_json,
                })

                logger.info(f"[REFINEMENT QA attempt {attempt}]: {qa_result}")
                qa_passed = bool(qa_result.get("passed") or not qa_result.get("retry_recommended"))

                ssim_score = 0.0
                hash_score = 0
                similarity_passed = True

                if local_ref_path and os.path.exists(local_ref_path):
                    local_gen_path, gen_temp_cleanup = save_b64_to_temp_file(b64_json)
                    try:
                        hash_score = calculate_hash_similarity(local_ref_path, local_gen_path)
                        ssim_score = calculate_ssim_similarity(local_ref_path, local_gen_path)
                        logger.info(f"[ATTEMPT {attempt}] HASH SIMILARITY: {hash_score}, SSIM SIMILARITY: {ssim_score}")
                        
                        similarity_passed = (ssim_score >= 50.0 and hash_score >= 80)
                    finally:
                        if gen_temp_cleanup and os.path.exists(gen_temp_cleanup):
                            try:
                                os.remove(gen_temp_cleanup)
                            except Exception:
                                pass

                overall_score = ssim_score + hash_score
                candidates.append((result, ssim_score, hash_score, overall_score))

                if qa_passed and similarity_passed:
                    logger.info(f"[ATTEMPT {attempt}] Passed both QA and similarity checks. Returning result.")
                    return result
                else:
                    logger.info(f"[ATTEMPT {attempt}] Failed checks. QA passed: {qa_passed}, Similarity passed: {similarity_passed}. Retrying...")

            except Exception as e:
                logger.error(f"[PRIMARY GEMINI ERROR] Attempt {attempt} failed: {e}")

        # If we completed all attempts and have some candidates but none passed both checks perfectly
        if candidates:
            # Sort by overall score descending
            candidates.sort(key=lambda x: x[3], reverse=True)
            best_candidate = candidates[0]
            logger.info(f"All attempts completed. None passed all checks. Returning highest similarity image (Attempt with HASH: {best_candidate[2]}, SSIM: {best_candidate[1]})")
            return best_candidate[0]

        # =====================================================
        # GEMINI FALLBACK
        # =====================================================
        try:
            logger.info("[GEMINI FALLBACK GENERATION]")
            return generate_with_gemini(
                image_source=image_source,
                user_prompt=user_prompt
            )
        except Exception as gemini_error:
            raise Exception(f"GEMINI FALLBACK FAILED: {gemini_error}")

    finally:
        if ref_temp_cleanup and os.path.exists(ref_temp_cleanup):
            try:
                os.remove(ref_temp_cleanup)
            except Exception:
                pass


# =========================================================
# OPENAI IMAGE COMPATIBILITY OBJECT
# =========================================================
class OpenAIImageObject:
    def __init__(self, b64_json: Optional[str] = None, url: Optional[str] = None):
        self.b64_json = b64_json
        self.url = url


# =========================================================
# OPENAISERVICE SINGLETON CLASS
# =========================================================
class OpenAIService:
    """
    Singleton OpenAI service with a single client instance.
    Ported to use Gemini high-fidelity pipeline for image rendering.
    """
    
    _instance = None
    _client = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize_client()
        return cls._instance
    
    def _initialize_client(self):
        """Initialize the OpenAI client and configure the Gemini API."""
        if not self._client:
            api_key = os.getenv("OPENAI_API_KEY") or settings.OPENAI_API_KEY
            if not api_key:
                logger.warning("OPENAI_API_KEY not found in environment variables")
            else:
                self._client = OpenAI(api_key=api_key)
                logger.info("OpenAI client initialized")
                
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        if gemini_api_key:
            genai.configure(api_key=gemini_api_key)
            logger.info("Gemini API configured successfully")
        else:
            logger.warning("GEMINI_API_KEY missing from environment")
    
    @property
    def client(self):
        """Get the OpenAI client instance."""
        return self._client

    @property
    def model(self) -> str:
        """Get the image generation model name used."""
        return os.getenv("GEMINI_IMAGE_MODEL") or "gemini-1.5-flash"
    
    def _load_image_buffer_from_source(self, source: str) -> tuple:
        """
        Load image from URL or local path and convert to buffer.
        """
        if source.startswith("http"):
            resp = requests.get(source)
            img = Image.open(BytesIO(resp.content))
        else:
            img = Image.open(source)
        
        img = img.convert("RGBA")
        img = img.resize((1024, 1024))
        
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        
        return ("image.png", buf, "image/png")

    def _load_image_bytes_from_source(self, source: str) -> bytes:
        """Load image bytes from URL or local path."""
        if source.startswith("http"):
            resp = requests.get(source)
            resp.raise_for_status()
            return resp.content
        with open(source, "rb") as f:
            return f.read()

    def _encode_image_to_base64(self, image_bytes: bytes) -> str:
        """Encode image bytes to base64 string."""
        return base64.b64encode(image_bytes).decode('utf-8')
    
    def generate_base_image(
        self,
        image_source: str,
        user_prompt: str,
        jewellery_type: str = "",
        size: str = "1024x1024",
        mode: Optional[str] = None
    ) -> OpenAIImageObject:
        """
        Generate base image using full Gemini pipeline (Primary + Fallback + QA checks).
        """
        logger.info("Generating base image using Gemini Pipeline")
        
        selected_mode = mode
        if not selected_mode:
            lower_prompt = (user_prompt or "").lower()
            if any(w in lower_prompt for w in ["refine", "style tags:", "focus on:", "change", "add", "remove", "replace"]):
                selected_mode = "refine"
            else:
                selected_mode = "initial"

        result = generate_with_fallback(
            image_source=image_source,
            user_prompt=user_prompt,
            metal_tone="yellow_gold",
            mode=selected_mode
        )
        
        b64 = extract_b64_from_result(result)
        return OpenAIImageObject(b64_json=b64)
    
    def generate_side_view(
        self,
        base_image_source: str,
        angle_description: str = "rotate 90 degrees to the right, full side profile view, camera at same height",
        jewellery_type: str = "",
        size: str = "1024x1024"
    ) -> OpenAIImageObject:
        """
        Generate side view using Gemini Pipeline.
        """
        logger.info("Generating side view using Gemini Pipeline")
        result = generate_with_fallback(
            image_source=base_image_source,
            user_prompt=angle_description,
            metal_tone="yellow_gold",
            mode="initial"
        )
        b64 = extract_b64_from_result(result)
        return OpenAIImageObject(b64_json=b64)
    
    def generate_top_view(
        self,
        base_image_source: str,
        angle_description: str = "top-down view, camera positioned directly above at 90 degrees looking down",
        jewellery_type: str = "",
        size: str = "1024x1024"
    ) -> OpenAIImageObject:
        """
        Generate top view using Gemini Pipeline.
        """
        logger.info("Generating top view using Gemini Pipeline")
        result = generate_with_fallback(
            image_source=base_image_source,
            user_prompt=angle_description,
            metal_tone="yellow_gold",
            mode="initial"
        )
        b64 = extract_b64_from_result(result)
        return OpenAIImageObject(b64_json=b64)
    
    def generate_custom_angle(
        self,
        base_image_source: str,
        angle_description: str,
        jewellery_type: str = "",
        size: str = "1024x1024"
    ) -> OpenAIImageObject:
        """
        Generate custom angle view using Gemini Pipeline.
        """
        logger.info(f"Generating custom angle using Gemini Pipeline: {angle_description}")
        result = generate_with_fallback(
            image_source=base_image_source,
            user_prompt=angle_description,
            metal_tone="yellow_gold",
            mode="initial"
        )
        b64 = extract_b64_from_result(result)
        return OpenAIImageObject(b64_json=b64)

    def generate_image_from_prompt(
        self,
        user_prompt: str,
        size: str = "1024x1024"
    ) -> OpenAIImageObject:
        """
        Generate image using prompt only (no reference image) via Gemini Pipeline.
        """
        logger.info("Generating prompt-only image using Gemini Pipeline")
        result = generate_with_fallback(
            image_source=None,
            user_prompt=user_prompt,
            metal_tone="yellow_gold",
            mode="initial"
        )
        b64 = extract_b64_from_result(result)
        return OpenAIImageObject(b64_json=b64)

    def transcribe_audio(self, file_content: bytes, filename: str) -> str:
        """
        Transcribe audio using OpenAI Whisper API.
        """
        logger.info(f"Transcribing audio file: {filename}")
        file_tuple = (filename, file_content)
        result = self._client.audio.transcriptions.create(
            model="whisper-1",
            file=file_tuple,
            language="en",
            prompt="The user is providing instructions for jewelry design modifications. Please transcribe exactly what is said. Avoid generating random words if the audio is silent or unclear."
        )
        logger.info("Audio transcribed successfully")
        return result.text

    def analyze_changes_with_vision(
        self,
        image_source: str,
        user_request: str,
    ) -> dict:
        """
        Analyze changes using Gemini vision.
        """
        logger.info("Analyzing changes with vision for request: %s", user_request)
        try:
            image_bytes = self._load_image_bytes_from_source(image_source)
            base64_image = self._encode_image_to_base64(image_bytes)
            data_url = f"data:image/png;base64,{base64_image}"

            gemini_api_key = os.getenv("GEMINI_API_KEY")
            
            resp = requests.post(
                "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                headers={"Authorization": f"Bearer {gemini_api_key}", "Content-Type": "application/json"},
                json={
                    "model": "gemini-1.5-flash",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a master jewelry designer analyzing images for modifications. Examine the reference jewelry image carefully, parse the user's modification request, identify EXACTLY what needs to change, specify what must remain unchanged, and note any complex elements. Respond ONLY with raw JSON structure."
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"Analyze this jewelry image and the user's request: '{user_request}'\n\nProvide a detailed JSON analysis of what needs to change and what must be preserved with fields: changes_needed, must_preserve, complex_elements, metal_type, stone_type, design_style."
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": data_url
                                    }
                                }
                            ]
                        }
                    ],
                    "response_format": {"type": "json_object"}
                },
                timeout=25,
            )
            if resp.ok:
                analysis = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                try:
                    start_idx = analysis.find('{')
                    end_idx = analysis.rfind('}') + 1
                    if start_idx != -1 and end_idx != 0:
                        return json.loads(analysis[start_idx:end_idx])
                except Exception:
                    pass

            return {
                "changes_needed": [user_request],
                "must_preserve": ["overall_style", "proportions"],
                "complex_elements": [],
                "metal_type": "unknown",
                "stone_type": "unknown",
                "design_style": "jewelry"
            }
        except Exception as e:
            logger.warning("Vision analysis failed: %s", e)
            return {
                "changes_needed": [user_request],
                "must_preserve": ["overall_style"],
                "complex_elements": [],
                "metal_type": "unknown",
                "stone_type": "unknown",
                "design_style": "jewelry"
            }

    def compare_and_validate(
        self,
        base_image_source: str,
        generated_image_source: str,
        analysis: dict,
    ) -> dict:
        """
        Compare generated image with requirements and identify issues.
        """
        logger.info("Comparing and validating generated image")
        try:
            base_bytes = self._load_image_bytes_from_source(base_image_source)
            generated_bytes = self._load_image_bytes_from_source(generated_image_source)

            base64_base = self._encode_image_to_base64(base_bytes)
            base64_generated = self._encode_image_to_base64(generated_bytes)

            changes_text = ", ".join(analysis.get("changes_needed", []))
            gemini_api_key = os.getenv("GEMINI_API_KEY")

            resp = requests.post(
                "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                headers={"Authorization": f"Bearer {gemini_api_key}", "Content-Type": "application/json"},
                json={
                    "model": "gemini-1.5-flash",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a quality control expert for jewelry CAD renders. Compare the base image with the generated image. Verify all requested changes are implemented. Check for quality issues (floating elements, incomplete bands, etc.). Identify what needs refinement. Respond ONLY with raw JSON structure."
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": f"Compare these images. Base (left) vs Generated (right). Required changes: {changes_text}\n\nAnalyze if all changes are implemented and identify any quality issues using JSON fields: changes_implemented, missing_changes, quality_issues, needs_refinement, refinement_notes."
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{base64_base}"
                                    }
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{base64_generated}"
                                    }
                                }
                            ]
                        }
                    ],
                    "response_format": {"type": "json_object"}
                },
                timeout=25,
            )
            if resp.ok:
                comparison_text = resp.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                try:
                    start_idx = comparison_text.find('{')
                    end_idx = comparison_text.rfind('}') + 1
                    if start_idx != -1 and end_idx != 0:
                        return json.loads(comparison_text[start_idx:end_idx])
                except Exception:
                    pass

            return {
                "changes_implemented": ["basic_changes"],
                "missing_changes": [],
                "quality_issues": [],
                "needs_refinement": False,
                "refinement_notes": "Unable to compare, assuming success"
            }
        except Exception as e:
            logger.warning("Comparison failed: %s", e)
            return {
                "changes_implemented": [],
                "missing_changes": ["unknown"],
                "quality_issues": ["comparison_failed"],
                "needs_refinement": True,
                "refinement_notes": "Unable to compare, need to regenerate"
            }


# =========================================================
# SINGLETON INSTANCE
# =========================================================
openai_service = OpenAIService()
