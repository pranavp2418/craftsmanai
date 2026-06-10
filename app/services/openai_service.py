"""
OpenAI Service - Centralized service supporting OpenAI rendering pipeline.
Uses the high-fidelity rendering, refinement interpretation, and QA Auditor flow.
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
from typing import List, Dict, Any, Optional, Tuple

import imagehash
from PIL import Image
from openai import OpenAI
from dotenv import load_dotenv

from app.core.config import settings

load_dotenv()

def get_openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY") or settings.OPENAI_API_KEY
    if not api_key:
        raise ValueError("OPENAI_API_KEY missing from environment")
    return OpenAI(api_key=api_key)

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
- no duplicate, double, or overlapping bails/loops on pendants; a pendant must have exactly one single, clean, structurally sound bail (such as a hinge bail, v-bail, or simple loop) connecting it to the chain.

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
- Absolutely NO text annotations, captions, callouts, labels, numbers, letters, or watermarks are allowed in the background or around the jewelry.
"""

SUPPORTED_TAXONOMY = """
SUPPORTED TYPES (map every job to one — never invent fantasy categories):
Rings (Band, Bust Down, Signet, Statement, Wedding, Engagement, Custom Shape) · Pendants (Name/Initial, Picture, Religious, Logo/Brand, Symbol/Icon, Custom Shape) · Chains (Box, Cuban, Figaro, Franco, Rope, Tennis, Link, Custom Shape) · Earrings (Hoop, Stud, Drop, Chandelier, Ear Cuff, Custom Shape) · Bracelets (Bangle, Cuff, Charm, Cuban, Tennis, ID, Custom Shape) · Grillz (Single Tooth, Top, Bottom, Full Set, Custom) · Watches (Skeleton, Iced Apple Watch, Diamond Dial, Bezel-Iced, Fully Iced, Custom).
"""

OUTPUT_CONTRACT = """
OUTPUT: Exactly ONE image. Size must be exactly 1024x1024 pixels. Front-facing hero angle. CAD-styled approval render on a clean white background. Centered piece, no environment. Do NOT output a split-screen, grid layout, side-by-side comparison, or before-and-after panels showing the reference image next to the new design. The output must contain ONLY the new jewelry piece. Absolutely NO floating text, watermarks, annotations, labels, captions, or callouts are allowed in the output image.
"""

HOUSE_STYLE = """
STYLE: Clean CAD-styled jewelry approval render. Isolated piece on a pure, solid, clean white background (#FFFFFF).
- Image size must be exactly 1024x1024 pixels.
- Absolutely NO hands, fingers, nails, fingernails, nail polish, manicured fingers, skin, neck, body parts, props, display boxes, or real-world environments.
- Even if the reference image shows the jewelry on a hand/body or in a box, you MUST remove/strip the hand/body/box/nails/fingers and render the jewelry piece completely isolated.
- The render MUST be a clean, front-facing hero angle, centered, with crisp edges and a premium, manufacturable look.
- Realistic metal and stones. No cinematic atmosphere or heavy shadows. Always ignore the background/props/hands of any reference image and render the piece on pure solid white.
- Absolutely NO text labels, names, numbers, annotations, captions, scale bars, or callouts floating in the background or around the jewelry. The image must be completely clean, featuring ONLY the isolated jewelry piece itself.
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
- Do NOT output a split-screen, grid layout, side-by-side comparison, or before-and-after panels showing the reference image next to the new design. The output image must contain ONLY the single new/modified jewelry design on a solid white background.
- Do NOT render any text labels, annotations, captions, titles, letters, numbers, callouts, arrows, or watermarks floating in the air or background around the jewelry piece. The image must contain ONLY the physical jewelry itself, with no text overlays or annotations whatsoever.
- Do NOT render any human body parts, hands, fingers, fingernails, nails, nail polish, manicured hands, skin textures, display boxes, or background props. The output must show ONLY the clean, isolated jewelry design on a solid, clean, seamless white background.
- Do NOT render duplicate, double, or overlapping bails or loops at the top of a pendant. Renders of pendants must feature exactly one single, well-proportioned, structurally realistic bail (e.g., a single hinge bail, v-bail, or simple loop) connecting it to the chain.
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
- (EXCEPTION: Do NOT preserve the reference image's background, lighting environment, props, or hands. The background MUST be pure, solid white (#FFFFFF) for every render).
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

def extract_text_replacements(prompt: str) -> List[Tuple[str, str]]:
    if not prompt:
        return []
    replacements = []
    
    def clean_phrase(p: str) -> str:
        p_clean = p.strip()
        lower = p_clean.lower()
        filler_prefixes = ["i want", "want", "use", "show", "have", "with", "the", "a", "an", "change", "replace"]
        for prefix in filler_prefixes:
            if lower.startswith(prefix + " "):
                p_clean = p_clean[len(prefix) + 1:].strip()
                lower = p_clean.lower()
        return p_clean

    # Pattern 1: [new] instead of [old]
    matches1 = re.findall(r"\b([\w\s']{1,35})\s+instead\s+of\s+([\w\s']{1,35})\b", prompt, re.IGNORECASE)
    for m in matches1:
        new_txt, old_txt = clean_phrase(m[0]), clean_phrase(m[1])
        replacements.append((old_txt, new_txt))
        
    # Pattern 2: change [old] to [new]
    matches2 = re.findall(r"\bchange\s+([\w\s']{1,35})\s+to\s+([\w\s']{1,35})\b", prompt, re.IGNORECASE)
    for m in matches2:
        old_txt, new_txt = clean_phrase(m[0]), clean_phrase(m[1])
        if not any(x in old_txt.lower() or x in new_txt.lower() for x in ["metal", "color", "tone", "gold", "silver"]):
            replacements.append((old_txt, new_txt))
            
    # Pattern 3: replace [old] with [new]
    matches3 = re.findall(r"\breplace\s+([\w\s']{1,35})\s+with\s+([\w\s']{1,35})\b", prompt, re.IGNORECASE)
    for m in matches3:
        old_txt, new_txt = clean_phrase(m[0]), clean_phrase(m[1])
        replacements.append((old_txt, new_txt))
        
    return replacements

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
    if any(x in lower for x in ["2 steps", "2 step", "two steps", "two step"]):
        directives.append(
            "For a fully iced 3D 2-step design: Both the primary/front layer and the secondary/backing layer must be fully covered with diamonds or stones. The secondary layer should be visibly raised and extend beyond the primary layer to create a pronounced three-dimensional two-tier effect with clear depth, thickness, and separation between layers. No plain metal borders, outlines, backing, exposed metal edges, or polished metal surfaces should be visible from the front. The design must showcase a bold, luxury, fully iced 3D stacked construction."
        )
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
        previous_fixes_text = f"\n\nPrevious fixes already applied (DO NOT undo):\n{previous_fixes}" if previous_fixes else ""
        refinement_lock_block = f"""
REFINEMENT LOCK (mandatory):
- The FIRST attached image is the LATEST APPROVED DRAFT — treat it as the absolute base
- This is an image edit, NOT a redesign
- Do NOT restart from the original logo reference, do NOT regenerate from scratch
- Apply ONLY the requested delta on top of the latest draft
- Preserve every previous successful fix
- If the request is ambiguous, under-edit rather than changing extra regions{previous_fixes_text}"""

    refinement_note_text = f"Refinement target regions: {regions}\nRefinement request: {note}" if mode == "refine" else (f"User note: {note}" if note else "")

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
{refinement_note_text}
{SHARED_RULES}

Generate ONE front-facing hero render of this CLASS / SIGNET RING — planar face, symmetrical shoulders, premium {metal}, clean background, exactly 1024x1024 pixels, approval-ready."""

def interpret_refinement(params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
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
        client = get_openai_client()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": REFINEMENT_INTERPRETER_SYSTEM},
                {"role": "user", "content": user_content},
            ],
            tools=tools,
            tool_choice={"type": "function", "function": {"name": "emit_refinement_intent"}},
            timeout=25,
        )
        tool_call = resp.choices[0].message.tool_calls[0]
        args = tool_call.function.arguments
        if not args:
            return None
        intent = args if isinstance(args, dict) else json.loads(args)
        intent["raw_user_prompt"] = intent.get("raw_user_prompt") or params.get("note", "")
        return intent
    except Exception as e:
        logger.error(f"Error in interpret_refinement: {e}")
        return None

def build_focused_refinement_prompt(intent: Dict[str, Any], base_fallback: str, attempt: int, version_number: int = 1) -> str:
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
    default_qa_text = (
    "- The requested change is visibly applied to the target component\n"
    "- All non-target regions remain identical"
)

    qa_text = qa_list or default_qa_text

    angle_rule = "Maintain camera angle, composition, lighting, background, 1024x1024 pixel size, and metal finish unless the change explicitly requires otherwise."
    keep_bg_rule = "Keep the same jewelry type, same camera angle, same composition, same lighting, same background. The output image size must be exactly 1024x1024 pixels."
    if version_number <= 1:
        angle_rule = """CAMERA ANGLE & BACKGROUND OVERRIDE (CRITICAL):
- The output image size must be exactly 1024x1024 pixels (1:1 square aspect ratio).
- Do NOT copy the background, environment, lighting, hand, fingers, skin, or props from the reference. The background must be pure solid white (#FFFFFF).
- Do NOT copy the tilted hand-held angle. You MUST render the jewelry piece centered, flat, and front-facing toward the camera (front-facing hero view).
- Strip the hand/body away completely and render only the jewelry piece."""
        keep_bg_rule = "Keep the same jewelry type structure, but override background, lighting, and camera angle to be front-facing hero view on pure solid white background (#FFFFFF). The output image size must be exactly 1024x1024 pixels."

    replacements = extract_text_replacements(change)
    replacement_block = ""
    if replacements:
        replacement_block = "\n\nCRITICAL TEXT & COMPONENT REPLACEMENTS (NON-NEGOTIABLE):\n"
        for old_txt, new_txt in replacements:
            replacement_block += f"- You MUST completely remove the text/element '{old_txt}' and replace it with '{new_txt}'. Do NOT keep any part of '{old_txt}'. The spelling of the new text must be exactly '{new_txt}' (case-sensitive if it matches a name/initials/letters).\n"

    return f"""REFINEMENT INTELLIGENCE — TARGETED EDIT (attempt {attempt})

The FIRST attached image is the CURRENT APPROVED RENDER / MASTER REFERENCE.
This is an IMAGE EDIT, not a redesign.

PRIORITY ORDER (do not violate):
1. Apply the explicit user-requested change to the target component.
2. Preserve every non-target component pixel-faithfully.
3. Maintain jewelry realism and manufacturability.
4. Maintain premium CAD-styled render quality.
5. {angle_rule}

Never let preservation rules cancel the target edit. Preservation applies only to non-target regions.

TARGET COMPONENT(S): {targets}
TARGET REGION(S): {regions}
ATTRIBUTE TO CHANGE: {intent.get('attribute_to_change') or '(inferred)'}
{from_to}

NORMALIZED INSTRUCTION (use this, not the raw user words):
{change}{replacement_block}

{strategy_hint}

{intensity}{retry_rewrite}

PRESERVE EXACTLY (do not touch): {preserve}.
Do NOT add, remove, resize, recolor, or alter any non-target component.
Do NOT change subtype. Do NOT introduce new decorative elements. {keep_bg_rule}

VISUAL QA CHECKLIST the output MUST satisfy:
{qa_text}

The output must look like a premium CAD-style jewelry render, physically plausible and production-friendly.

(Internal fallback context, lower priority than the rules above):
{base_fallback}"""

def qa_refinement_check(params: Dict[str, Any]) -> Dict[str, Any]:
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
        client = get_openai_client()
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a strict jewelry-render QA inspector. You only call the emit_qa_verdict tool."},
                {"role": "user", "content": user_content},
            ],
            tools=tools,
            tool_choice={"type": "function", "function": {"name": "emit_qa_verdict"}},
            timeout=30,
        )
        tool_call = resp.choices[0].message.tool_calls[0]
        args = tool_call.function.arguments
        if not args:
            return {"passed": True, "reason": "qa_no_tool_call", "failed_checks": [], "retry_recommended": False}
        verdict = args if isinstance(args, dict) else json.loads(args)
        return {
            "passed": bool(verdict.get("passed")),
            "reason": verdict.get("reason") or "",
            "failed_checks": verdict.get("failed_checks") or [],
            "retry_recommended": bool(verdict.get("retry_recommended")),
        }
    except Exception as e:
        logger.error(f"Error in qa_refinement_check: {e}")
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

    # If the user didn't mention a metal:
    # 1. If the reference image is jewelry, default to the reference image metal fully.
    # 2. If it's not jewelry (or no reference image), default to gold.
    source_kind = pd.get("source_kind", "unknown")
    is_jewelry_ref = source_kind in ("jewelry_reference", "cad_render", "existing_jewelry")
    if not user_specifies_metal:
        if image_count and is_jewelry_ref:
            if pd.get("metal_tone"):
                metal_tone = pd.get("metal_tone")
            else:
                if metal_tone in ("yellow_gold", "rose_gold", "white_gold", "silver", "platinum"):
                    metal_tone = metal_tone.replace("_", " ")
                else:
                    metal_tone = "same as the attached reference image"
        else:
            if metal_tone:
                metal_tone = metal_tone.replace("_", " ")
            else:
                metal_tone = "yellow gold"
    intent = pd.get("request_intent", "render_as_is")
    note_lower = (note or "").lower()
    if any(keyword in note_lower for keyword in ["change", "convert", "replace", "modify", "remove", "add", "switch", "edit", "update"]):
        if "convert" in note_lower:
            intent = "convert_to_jewelry"
        else:
            intent = "modify_existing"
            
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
        stone_row_text = f"- Row count: {stone_row_count} rows (MUST be respected — reduce stone size to fit if needed)" if stone_row_count else ""
        stone_block = f"""
Stone details:
- Presence: {stone_presence}, Coverage: {stone_coverage}, Layout: {stone_layout}
- Size class: {stone_size_class} (default small-to-mid — do NOT use chunky large stones unless explicitly requested)
{stone_row_text}
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

        previous_fixes_appendage = "\n\nPrevious fixes already applied (preserve all of these):\n" + previous_fixes if previous_fixes else ""
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
- The output must be visually identical to the input EXCEPT for the requested change.{previous_fixes_appendage}"""

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
Metal tone: {metal_tone or "yellow gold"}
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
Metal tone: {metal_tone or "yellow gold"}
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
Metal tone: {metal_tone or "yellow gold"}
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
    refinement_mode = None
    target_regions = None
    if mode == "refine":
        if refinement_intent:
            strategy = refinement_intent.get("render_strategy") or ""
            if strategy == "full_regeneration":
                refinement_mode = "FULL_REGEN"
            elif strategy in ("partial_regeneration", "component_inpaint"):
                refinement_mode = "PARTIAL_REGEN"
            else:
                refinement_mode = "LOCAL_EDIT"
            target_regions = refinement_intent.get("target_regions")
        
        # Fall back to regex if still not resolved
        if not refinement_mode:
            refinement_mode = classify_refinement(note)
        if not target_regions:
            target_regions = identify_target_regions(note)

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
        "REFINEMENT MODE. The first attached image is the CURRENT RENDER. Apply ONLY the change described. Keep the design structure identical, BUT you MUST render the piece isolated and centered on a pure, solid, clean white background (#FFFFFF). Do NOT copy the background, shadows, lighting environment, hands, fingers, fingernails, nail polish, skin, or props from the reference. You MUST strip away any hands, body parts, fingernails, or polish and render ONLY the jewelry piece itself as a clean, front-facing hero view on pure solid white. Do NOT output a split-screen, grid layout, side-by-side comparison, or before-and-after panels showing the reference image next to the new design. The output must contain ONLY the new jewelry piece."
        if is_refine
        else "JEWELRY RENDER. If reference image(s) are attached, the FIRST is the master reference. Reproduce the design structure as faithfully as possible, BUT render it isolated and centered on a pure, solid, clean white background (#FFFFFF). Do NOT copy the background, environment, lighting, hands, fingers, fingernails, nail polish, skin, or props from the reference. You MUST strip away any hands, body parts, fingernails, or nail polish and render ONLY the jewelry piece itself as a clean, front-facing hero view on pure solid white. Never refuse. Do NOT output a split-screen, grid layout, side-by-side comparison, or before-and-after panels showing the reference image next to the new design. The output must contain ONLY the new jewelry piece."
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
        focused_prompt = build_focused_refinement_prompt(refinement_intent, base_prompt, attempt, version_number)

    final_prompt = f"""{CRAFTSMAN_MASTER_SYSTEM_PROMPT}

{system_preamble}

{focused_prompt}{set_no_hook_constraint}"""

    return final_prompt.strip()

def crop_to_jewelry(img: Image.Image) -> Image.Image:
    try:
        rgba = img.convert("RGBA")
        import numpy as np
        arr = np.array(rgba)
        r = arr[:, :, 0]
        g = arr[:, :, 1]
        b = arr[:, :, 2]
        # Background is white (r > 240 and g > 240 and b > 240)
        white_mask = (r > 240) & (g > 240) & (b > 240)
        arr[:, :, 3][white_mask] = 0
        
        temp_img = Image.fromarray(arr)
        bbox = temp_img.getbbox()
        if bbox:
            cropped = img.crop(bbox)
            canvas = Image.new("RGB", (512, 512), (255, 255, 255))
            cropped.thumbnail((512, 512), Image.Resampling.LANCZOS)
            offset = ((512 - cropped.width) // 2, (512 - cropped.height) // 2)
            canvas.paste(cropped, offset)
            return canvas
    except Exception as e:
        logger.error(f"Error in crop_to_jewelry: {e}")
    return img

def enforce_image_specs(b64_json: str) -> str:
    try:
        from io import BytesIO
        img_data = base64.b64decode(b64_json)
        img = Image.open(BytesIO(img_data))
        original_format = img.format or "PNG"
        
        # Enforce white background if there is alpha/transparency
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            canvas = Image.new("RGB", img.size, (255, 255, 255))
            canvas.paste(img, mask=img.convert("RGBA").split()[3])
            img = canvas
        else:
            img = img.convert("RGB")
            
        # Enforce exact size 1024x1024 with aspect ratio preservation (no stretching/distortion)
        if img.size != (1024, 1024):
            logger.info(f"Resizing/centering generated image from {img.size} to (1024, 1024)")
            canvas = Image.new("RGB", (1024, 1024), (255, 255, 255))
            w, h = img.size
            scale = min(1024 / w, 1024 / h)
            new_w = int(w * scale)
            new_h = int(h * scale)
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            offset = ((1024 - new_w) // 2, (1024 - new_h) // 2)
            canvas.paste(img, offset)
            img = canvas
            
        buffered = BytesIO()
        img.save(buffered, format=original_format)
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    except Exception as e:
        logger.error(f"Error enforcing image specs: {e}")
        return b64_json


def calculate_hash_similarity(img1: str, img2: str) -> int:
    try:
        pil_img1 = Image.open(img1)
        pil_img2 = Image.open(img2)
        
        cropped_img1 = crop_to_jewelry(pil_img1)
        cropped_img2 = crop_to_jewelry(pil_img2)
        
        hash1 = imagehash.average_hash(cropped_img1)
        hash2 = imagehash.average_hash(cropped_img2)
        return 100 - (hash1 - hash2)
    except Exception as e:
        logger.error(f"Error calculating hash similarity: {e}")
        return 0

def calculate_ssim_similarity(img1: str, img2: str) -> float:
    if not SSIM_ENABLED:
        return 0.0
    try:
        pil_img1 = Image.open(img1)
        pil_img2 = Image.open(img2)
        
        cropped_img1 = crop_to_jewelry(pil_img1)
        cropped_img2 = crop_to_jewelry(pil_img2)
        
        import numpy as np
        # Convert PIL RGB to OpenCV BGR
        image1 = cv2.cvtColor(np.array(cropped_img1), cv2.COLOR_RGB2BGR)
        image2 = cv2.cvtColor(np.array(cropped_img2), cv2.COLOR_RGB2BGR)
        
        image1 = cv2.cvtColor(image1, cv2.COLOR_BGR2GRAY)
        image2 = cv2.cvtColor(image2, cv2.COLOR_BGR2GRAY)
        image2 = cv2.resize(image2, (image1.shape[1], image1.shape[0]))
        
        score, _ = ssim(image1, image2, full=True)
        return round(score * 100, 2)
    except Exception as e:
        logger.error(f"Error calculating ssim: {e}")
        return 0.0

def extract_b64_from_result(result: Any) -> Optional[str]:
    b64 = getattr(result, "b64_json", None) or (
        result.get("b64_json")
        if isinstance(result, dict)
        else None
    )
    if not b64:
        try:
            if hasattr(result, "candidates"):
                for candidate in result.candidates:
                    for part in candidate.content.parts:
                        inline_data = getattr(part, "inline_data", None)
                        if inline_data and hasattr(inline_data, "data"):
                            b64 = base64.b64encode(inline_data.data).decode("utf-8")
                            break
        except Exception:
            pass

    if b64:
        return enforce_image_specs(b64)
    return None


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



def translate_prompt_for_dalle(prompt_text: str, image_urls: list[str] = None) -> tuple[str, str]:
    """
    Use gpt-4o-mini to convert a complex structured system prompt into a concise, 
    highly optimized visual-only prompt for DALL-E, and detect the metal tone.
    Optionally looks at the reference images to generate a more accurate visual description and metal classification.
    """
    client = get_openai_client()
    try:
        logger.info("[PROMPT TRANSLATION] Cleaning complex prompt and detecting metal tone using gpt-4o-mini")
        
        # Prepare visual inputs if reference images are available
        image_contents = []
        if image_urls:
            for url in image_urls:
                try:
                    if url.startswith("data:"):
                        _, encoded = url.split(",", 1)
                        img_bytes = base64.b64decode(encoded)
                    elif url.startswith("http"):
                        resp = requests.get(url, timeout=10)
                        resp.raise_for_status()
                        img_bytes = resp.content
                    elif os.path.exists(url):
                        with open(url, "rb") as f:
                            img_bytes = f.read()
                    else:
                        continue
                    
                    # Encode to base64 data URL
                    b64_str = base64.b64encode(img_bytes).decode('utf-8')
                    image_contents.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{b64_str}"
                        }
                    })
                except Exception as ex:
                    logger.warning(f"[PROMPT TRANSLATION] Failed to load image {url[:50]} for prompt translator: {ex}")

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a prompt translator and jewelry analyzer. Read the rendering instruction, "
                    "view the reference image(s), and output a JSON object with the following fields:\n"
                    "- 'dalle_prompt': An optimized, highly descriptive prompt for DALL-E 3 (1-2 sentences). Describe the background strictly as 'isolated on a pure, solid, clean white background (#FFFFFF)'. Do NOT include negation words.\n"
                    "- 'detected_metal': Identify the metal tone from the image/prompt as one of: 'gold' (yellow gold), 'silver' (white gold/silver/platinum), or 'rose_gold'.\n"
                    "RULES for 'detected_metal':\n"
                    "1. If a metal tone is explicitly mentioned in the user prompt (e.g. 'rose gold', 'platinum', 'yellow gold', 'silver', 'white gold'), use that.\n"
                    "2. If no metal tone is specified and the reference image is NOT jewelry (e.g. it is a drawing, sketch, logo, cartoon, deity portrait), default to 'gold'.\n"
                    "3. If no metal is specified and the reference image IS jewelry, detect the metal tone of the jewelry in the image.\n\n"
                    "Output MUST be valid JSON only. Do not include markdown block formatting."
                )
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Analyze and translate this jewelry instruction:\n\n{prompt_text}"
                    }
                ] + image_contents
            }
        ]
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=250,
            timeout=15
        )
        response_text = response.choices[0].message.content.strip()
        logger.info(f"[PROMPT TRANSLATION] Raw JSON response: {response_text}")
        
        import json
        data = json.loads(response_text)
        cleaned_prompt = data.get("dalle_prompt", "").strip()
        detected_metal = data.get("detected_metal", "gold").strip().lower()
        if detected_metal not in ["gold", "silver", "rose_gold"]:
            detected_metal = "gold"
            
        logger.info(f"[PROMPT TRANSLATION] Cleaned prompt: {cleaned_prompt}")
        logger.info(f"[PROMPT TRANSLATION] Detected metal: {detected_metal}")
        return cleaned_prompt, detected_metal
    except Exception as e:
        logger.warning(f"[PROMPT TRANSLATION] Translation failed: {e}. Falling back to local metal detection and original prompt.")
        lower = (prompt_text or "").lower()
        detected_metal = "gold"
        if "rose gold" in lower or "rose-gold" in lower or "rose_gold" in lower:
            detected_metal = "rose_gold"
        elif "white gold" in lower or "white-gold" in lower or "white_gold" in lower or "silver" in lower or "platinum" in lower or "sterling" in lower:
            detected_metal = "silver"
        return prompt_text, detected_metal


def generate_with_openai_image(
    image_urls: list[str],
    prompt_text: str,
    bypass_translation: bool = False,
    mode: str = "initial"
) -> str:
    """Generate image using OpenAI gpt-image-2.

    Uses images.edit when reference images are provided,
    images.generate otherwise.
    Returns base64-encoded PNG image data.
    """
    client = get_openai_client()
    
    # Download/process all reference images as file tuples
    image_files = []
    if image_urls:
        for idx, url in enumerate(image_urls):
            try:
                if url.startswith("data:"):
                    # Data URI — extract base64 payload
                    _, encoded = url.split(",", 1)
                    img_bytes = base64.b64decode(encoded)
                elif url.startswith("http"):
                    resp = requests.get(url, timeout=20)
                    resp.raise_for_status()
                    img_bytes = resp.content
                elif os.path.exists(url):
                    with open(url, "rb") as f:
                        img_bytes = f.read()
                else:
                    img_bytes = None

                if img_bytes:
                    img = Image.open(BytesIO(img_bytes))
                    img = img.convert("RGBA")
                    img = img.resize((1024, 1024))
                    buf = BytesIO()
                    img.save(buf, format="PNG")
                    buf.seek(0)
                    image_files.append((f"image_{idx}.png", buf, "image/png"))
            except Exception as e:
                logger.warning(f"Failed to fetch reference image {url[:80]}: {e}")

    # Clean the prompt using gpt-4o-mini translation layer to optimize for DALL-E unless bypassed
    detected_metal = None
    if not bypass_translation:
        dalle_prompt, detected_metal = translate_prompt_for_dalle(prompt_text, image_urls)
    else:
        logger.info("[PROMPT TRANSLATION] Bypassing prompt translation layer as requested")
        dalle_prompt = prompt_text
    truncated_prompt = dalle_prompt[:32000]
    max_attempts = 3

    for attempt in range(1, max_attempts + 1):
        try:
            img_kwargs = {
                "model": "gpt-image-2",
                "n": 1,
                "size": "1024x1024"
            }
            # Omit response_format for gpt-image models to avoid API parameter errors
            if "gpt-image" not in img_kwargs["model"]:
                img_kwargs["response_format"] = "b64_json"

            if image_files:
                # Reset all file buffer positions for retry
                for file_tuple in image_files:
                    file_tuple[1].seek(0)
                
                # Pass list of files if multiple, otherwise the single tuple
                image_arg = image_files if len(image_files) > 1 else image_files[0]
                result = client.images.edit(
                    image=image_arg,
                    prompt=truncated_prompt,
                    **img_kwargs
                )
            else:
                result = client.images.generate(
                    prompt=truncated_prompt,
                    **img_kwargs
                )

            data_item = result.data[0]
            b64 = getattr(data_item, "b64_json", None) or (
                data_item.get("b64_json") if isinstance(data_item, dict) else None
            )
            if not b64:
                url = getattr(data_item, "url", None) or (
                    data_item.get("url") if isinstance(data_item, dict) else None
                )
                if url:
                    resp = requests.get(url, timeout=20)
                    resp.raise_for_status()
                    b64 = base64.b64encode(resp.content).decode("utf-8")
            
            if b64:
                logger.info(f"OpenAI gpt-image-2 generation succeeded (attempt {attempt})")
                return b64, detected_metal

            raise ValueError("No image payload in OpenAI response")

        except Exception as e:
            if attempt == max_attempts:
                raise
            logger.warning(f"OpenAI attempt {attempt} failed: {e} — retrying")
            import time
            time.sleep(1.2 * attempt)

    raise ValueError("OpenAI gpt-image-2 generation failed after all attempts")

def build_safe_fallback_prompt(user_prompt: str, metal_tone: Optional[str] = None) -> str:
    metal_line = ""
    if metal_tone:
        normalized = metal_tone.replace("_", " ").strip().lower()
        if normalized in ("gold", "yellow gold"):
            normalized = "18K yellow gold"
        elif normalized == "rose gold":
            normalized = "18K rose gold"
        elif normalized == "silver":
            normalized = "sterling silver"
        elif normalized == "white gold":
            normalized = "18K white gold"
        elif normalized == "platinum":
            normalized = "platinum"
        metal_line = f"\nMetal tone: {normalized}"

    return f"""
Generate jewelry inspired by the uploaded reference while preserving the overall visual identity.

The output image size must be exactly 1024x1024 pixels (1:1 square aspect ratio).
Use clean jewelry CAD rendering on a pure solid white background (#FFFFFF).{metal_line}

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
    metal_tone: Optional[str] = None,
    mode: Optional[str] = None,
    version_number: int = 1,
    refinement_intent_override: Optional[Dict[str, Any]] = None,
    max_attempts: int = 3,
    bypass_translation: bool = False
) -> Any:
    # Force refinement mode if we have a reference image and the user prompt requests an edit/change/conversion
    has_reference_image = bool(image_source or image_urls)
    lower_prompt = (user_prompt or "").lower()
    edit_keywords = ["change", "convert", "replace", "modify", "remove", "add", "switch", "edit", "update"]
    selected_mode = mode
    if has_reference_image and any(w in lower_prompt for w in edit_keywords):
        selected_mode = "refine"
    elif not selected_mode:
        if any(w in lower_prompt for w in ["refine", "style tags:", "focus on:", "change", "add", "remove", "replace"]):
            selected_mode = "refine"
        else:
            selected_mode = "initial"

    if selected_mode == "refine":
        bypass_translation = True

    resolved_image_urls = resolve_image_urls(image_source, image_urls)

    refinement_intent = refinement_intent_override
    if not refinement_intent and selected_mode == "refine" and user_prompt:
        refinement_intent = interpret_refinement({
            "note": user_prompt,
            "parsedData": parsed_data or {},
            "imageUrls": resolved_image_urls,
            "metalTone": metal_tone,
            "versionNumber": version_number,
        })


    if not refinement_intent:
        if selected_mode == "refine":
            # Synthesize a robust refinement intent
            refinement_intent = {
                "normalized_prompt": user_prompt,
                "raw_user_prompt": user_prompt,
                "target_components": ["the requested component"],
                "attribute_to_change": "specified jewelry component",
                "from_state": "current state",
                "to_state": "new state",
                "render_strategy": "targeted_component_edit",
                "target_regions": ["unspecified"],
                "preserve_components": ["all other regions"],
                "qa_checks": [
                    "The requested change is visibly applied to the target component.",
                    "All non-target regions remain identical to the previous render.",
                    "No unrelated areas are redesigned or changed."
                ],
                "retry_prompt_if_failed": f"Refine the jewelry to apply this change: {user_prompt}. Preserve all other parts exactly as they are in the reference image."
            }
        else:
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
        # PRIMARY OPENAI GENERATION LOOP WITH AUDITING & SIMILARITY CHECK
        # =====================================================
        max_attempts_count = max_attempts
        previous_ref_url = resolved_image_urls[0] if resolved_image_urls else None

        for attempt in range(1, max_attempts_count + 1):
            if bypass_translation:
                final_prompt = user_prompt
            else:
                final_prompt = build_prompt(
                    user_prompt=user_prompt,
                    reference_image=image_source,
                    parsed_data=parsed_data,
                    mode=selected_mode,
                    metal_tone=metal_tone or "yellow_gold",
                    image_urls=resolved_image_urls,
                    version_number=version_number,
                    refinement_intent=refinement_intent,
                    attempt=attempt,
                )

            # Append front-facing and text attachment guidelines if we are refining/editing
            if selected_mode == "refine" and final_prompt:
                final_prompt += "\n\nThe render MUST remain in a front-facing hero angle. Any new or modified text or lettering must be physically attached, connected, and merged cleanly with the surrounding metal structure."

            try:
                logger.info(f"[PRIMARY OPENAI GENERATION] Attempt {attempt}/{max_attempts_count}")
                b64_json, detected_metal = generate_with_openai_image(
                    image_urls=resolved_image_urls,
                    prompt_text=final_prompt,
                    bypass_translation=bypass_translation,
                    mode=selected_mode
                )
                result = OpenAIImageObject(b64_json=b64_json, detected_metal=detected_metal)

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
                        
                        if ssim_score < 30.0 or hash_score < 60.0:
                            similarity_passed = False
                        else:
                            similarity_passed = True
                    finally:
                        if gen_temp_cleanup and os.path.exists(gen_temp_cleanup):
                            try:
                                os.remove(gen_temp_cleanup)
                            except Exception:
                                pass

                overall_score = ssim_score + hash_score
                candidates.append((result, ssim_score, hash_score, overall_score, qa_passed))

                # Return immediately if:
                # 1. We have a reference image and both SSIM >= 30 & Hash similarity >= 60
                # 2. We don't have a reference image and QA check passes
                if local_ref_path and os.path.exists(local_ref_path):
                    if similarity_passed:
                        logger.info(f"[ATTEMPT {attempt}] Similarity passed (SSIM: {ssim_score} >= 30, HASH: {hash_score} >= 60). Returning image.")
                        return result
                    else:
                        logger.info(f"[ATTEMPT {attempt}] Similarity below threshold (SSIM: {ssim_score} < 30 or HASH: {hash_score} < 60). Retrying...")
                else:
                    if qa_passed:
                        logger.info(f"[ATTEMPT {attempt}] Prompt-only mode: QA check passed. Returning image.")
                        return result
                    else:
                        logger.info(f"[ATTEMPT {attempt}] Prompt-only mode: QA check failed. Retrying...")

            except Exception as e:
                logger.error(f"[PRIMARY OPENAI ERROR] Attempt {attempt} failed: {e}")

        # If we completed all attempts and have some candidates but none passed both checks perfectly
        if candidates:
            # Sort by highest ssim, then highest hash
            candidates.sort(key=lambda x: (-x[1], -x[2]))
            best_candidate = candidates[0]
            logger.info(f"All attempts completed. Returning best candidate based on highest similarity (HASH: {best_candidate[2]}, SSIM: {best_candidate[1]}, QA passed: {best_candidate[4]})")
            return best_candidate[0]

        # =====================================================
        # OPENAI FALLBACK
        # =====================================================
        try:
            logger.info("[OPENAI FALLBACK GENERATION]")
            fallback_prompt = build_safe_fallback_prompt(user_prompt, metal_tone=metal_tone or "yellow_gold")
            b64, detected_metal = generate_with_openai_image(
                image_urls=resolved_image_urls,
                prompt_text=fallback_prompt
            )
            return OpenAIImageObject(b64_json=b64, detected_metal=detected_metal)
        except Exception as openai_error:
            raise Exception(f"OPENAI FALLBACK FAILED: {openai_error}")

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
    def __init__(self, b64_json: Optional[str] = None, url: Optional[str] = None, detected_metal: Optional[str] = None):
        self.b64_json = b64_json
        self.url = url
        self.detected_metal = detected_metal


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
        """Initialize the OpenAI client."""
        if not self._client:
            api_key = os.getenv("OPENAI_API_KEY") or settings.OPENAI_API_KEY
            if not api_key:
                logger.warning("OPENAI_API_KEY not found in environment variables")
            else:
                self._client = OpenAI(api_key=api_key)
                logger.info("OpenAI client initialized")
    
    @property
    def client(self):
        """Get the OpenAI client instance."""
        return self._client

    @property
    def model(self) -> str:
        """Get the image generation model name used."""
        return "gpt-image-2"
    
    def _load_image_buffer_from_source(self, source: str) -> tuple:
        """
        Load image from URL or local path and convert to buffer.
        """
        if source.startswith("http"):
            resp = requests.get(source)
            img = Image.open(BytesIO(resp.content))
        else:
            # Strip file:// prefix if present for local file paths
            if source.startswith("file://"):
                source = source[7:]
            img = Image.open(source)
        
        img = img.convert("RGBA")
        img = img.resize((1024, 1024))
        
        buf = BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        
        return ("image.png", buf, "image/png")

    def _load_image_bytes_from_source(self, source: str | list[str]) -> bytes:
        """Load image bytes from URL or local path."""
        src = source
        if isinstance(source, list):
            src = source[0] if source else ""
        if isinstance(src, str) and src.startswith("http"):
            resp = requests.get(src)
            resp.raise_for_status()
            return resp.content
        with open(src, "rb") as f:
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
        mode: Optional[str] = None,
        metal_tone: Optional[str] = None
    ) -> OpenAIImageObject:
        """
        Generate base image using full OpenAI pipeline (Primary + Fallback + QA checks).
        """
        logger.info("Generating base image using OpenAI Pipeline")
        
        selected_mode = mode
        if not selected_mode:
            lower_prompt = (user_prompt or "").lower()
            if any(w in lower_prompt for w in ["refine", "style tags:", "focus on:", "change", "add", "remove", "replace"]):
                selected_mode = "refine"
            else:
                selected_mode = "initial"

        # Let the vision translator detect the metal tone dynamically, or use explicitly passed metal tone
        result = generate_with_fallback(
            image_source=image_source,
            user_prompt=user_prompt,
            parsed_data={"item_type": jewellery_type} if jewellery_type else None,
            metal_tone=metal_tone,
            mode=selected_mode,
            version_number=1
        )
        
        b64 = extract_b64_from_result(result)
        
        # Resolve the final metal tone to yellow_gold/white_gold/rose_gold for task logging & storage
        detected_metal = getattr(result, "detected_metal", None)
        if not detected_metal:
            detected_metal = metal_tone or "yellow_gold"
        
        if detected_metal == "gold":
            detected_metal = "yellow_gold"
        elif detected_metal == "silver":
            detected_metal = "white_gold"
            
        return OpenAIImageObject(b64_json=b64, detected_metal=detected_metal)
    
    def generate_side_view(
        self,
        base_image_source: str,
        angle_description: str = "",
        user_prompt: str = "",
        jewellery_type: str = "",
        size: str = "1024x1024",
        metal_tone: Optional[str] = None
    ) -> OpenAIImageObject:
        """
        Generate side view using OpenAI Pipeline.
        """
        logger.info("Generating side view using OpenAI Pipeline")
        
        # Dynamically detect metal tone
        detected_metal = metal_tone
        if not detected_metal:
            try:
                from app.repositories.design_variant import detect_metal_tone
                metal_dict = detect_metal_tone(user_prompt or angle_description, base_image_source)
                if metal_dict:
                    detected_key = list(metal_dict.keys())[0]
                    detected_metal = "yellow_gold" if detected_key == "gold" else ("white_gold" if detected_key == "silver" else detected_key)
            except Exception:
                pass
        normalized_metal = detected_metal or "yellow_gold"

        prompt = f"Generate ONE side profile view of the jewelry design shown in the reference image. The structure, design pattern, and details must match perfectly, but viewed directly from the side. Solid clean white background (#FFFFFF). Isolated CAD style render."
        result = generate_with_fallback(
            image_source=base_image_source,
            user_prompt=prompt,
            parsed_data={"item_type": jewellery_type} if jewellery_type else None,
            metal_tone=normalized_metal,
            mode="initial"
        )
        b64 = extract_b64_from_result(result)
        return OpenAIImageObject(b64_json=b64)
    
    def generate_top_view(
        self,
        base_image_source: str,
        angle_description: str = "",
        user_prompt: str = "",
        jewellery_type: str = "",
        size: str = "1024x1024",
        metal_tone: Optional[str] = None
    ) -> OpenAIImageObject:
        """
        Generate top view using OpenAI Pipeline.
        """
        logger.info("Generating top view using OpenAI Pipeline")
        
        # Dynamically detect metal tone
        detected_metal = metal_tone
        if not detected_metal:
            try:
                from app.repositories.design_variant import detect_metal_tone
                metal_dict = detect_metal_tone(user_prompt or angle_description, base_image_source)
                if metal_dict:
                    detected_key = list(metal_dict.keys())[0]
                    detected_metal = "yellow_gold" if detected_key == "gold" else ("white_gold" if detected_key == "silver" else detected_key)
            except Exception:
                pass
        normalized_metal = detected_metal or "yellow_gold"

        prompt = f"Generate ONE top-down view (bird's-eye view looking directly down onto the top face) of the jewelry design shown in the reference image. Every design motif, letter shape, and stone layout must match the reference image exactly. Solid clean white background (#FFFFFF). Isolated CAD style render."
        result = generate_with_fallback(
            image_source=base_image_source,
            user_prompt=prompt,
            parsed_data={"item_type": jewellery_type} if jewellery_type else None,
            metal_tone=normalized_metal,
            mode="initial"
        )
        b64 = extract_b64_from_result(result)
        return OpenAIImageObject(b64_json=b64)
    
    def generate_custom_angle(
        self,
        base_image_source: str,
        angle_description: str = "",
        user_prompt: str = "",
        jewellery_type: str = "",
        size: str = "1024x1024",
        metal_tone: Optional[str] = None
    ) -> OpenAIImageObject:
        """
        Generate custom angle view using OpenAI Pipeline.
        """
        logger.info(f"Generating custom angle using OpenAI Pipeline: {angle_description}")
        
        # Dynamically detect metal tone
        detected_metal = metal_tone
        if not detected_metal:
            try:
                from app.repositories.design_variant import detect_metal_tone
                metal_dict = detect_metal_tone(user_prompt or angle_description, base_image_source)
                if metal_dict:
                    detected_key = list(metal_dict.keys())[0]
                    detected_metal = "yellow_gold" if detected_key == "gold" else ("white_gold" if detected_key == "silver" else detected_key)
            except Exception:
                pass
        normalized_metal = detected_metal or "yellow_gold"

        prompt = f"Generate ONE CAD style render of the jewelry piece in the reference image, viewed from this custom angle: {angle_description}. Solid clean white background (#FFFFFF). Centered, professional studio lighting."
        result = generate_with_fallback(
            image_source=base_image_source,
            user_prompt=prompt,
            parsed_data={"item_type": jewellery_type} if jewellery_type else None,
            metal_tone=normalized_metal,
            mode="initial"
        )
        b64 = extract_b64_from_result(result)
        return OpenAIImageObject(b64_json=b64)

    # Alias generate_custom_view to generate_custom_angle for backwards-compatibility
    generate_custom_view = generate_custom_angle

    def generate_metal_swatch(
        self,
        base_image_source: str,
        metal: str,
        user_prompt: str = "",
        jewellery_type: str = "",
        size: str = "1024x1024"
    ) -> OpenAIImageObject:
        """
        Generate a metal variation of the base image.
        Uses the high-fidelity refinement interpreter flow to change only the metal color,
        freezing all other aspects.
        """
        logger.info(f"Generating metal variation '{metal}' using OpenAI Refine Pipeline")
        
        normalized_metal_tone = metal
        if metal == "gold":
            normalized_metal_tone = "yellow_gold"
        elif metal == "silver":
            normalized_metal_tone = "white_gold"

        # Explicitly describe the color conversion for the refinement interpreter
        refinement_intent = {
            "normalized_prompt": f"Change ONLY the metal parts to {normalized_metal_tone.replace('_', ' ')}. Do not change stones, layout, design, text, background, or camera angle.",
            "raw_user_prompt": f"Convert to {normalized_metal_tone}",
            "target_components": ["all metal structures"],
            "attribute_to_change": "metal color / swatch conversion",
            "from_state": "original metal color",
            "to_state": normalized_metal_tone,
            "render_strategy": "color_only_edit",
            "target_regions": ["global_cosmetic"],
            "preserve_components": ["stones", "text", "shape", "silhouette", "bail", "background"],
            "qa_checks": [
                f"The metal color is visibly converted to {normalized_metal_tone.replace('_', ' ')}.",
                "Stones, text, shape, background, and camera angle remain exactly identical to the previous render."
            ],
            "retry_prompt_if_failed": f"Change the metal color to {normalized_metal_tone.replace('_', ' ')} while preserving the exact layout, stones, background, and structure."
        }

        result = generate_with_fallback(
            image_source=base_image_source,
            user_prompt=f"convert metal to {normalized_metal_tone}",
            parsed_data={"item_type": jewellery_type} if jewellery_type else None,
            metal_tone=normalized_metal_tone,
            mode="refine",
            refinement_intent_override=refinement_intent,
            max_attempts=1,
            bypass_translation=True
        )
        b64 = extract_b64_from_result(result)
        return OpenAIImageObject(b64_json=b64)

    def generate_metal_variation(
        self,
        base_image_source: str,
        metal: str,
        user_prompt: str = "",
        jewellery_type: str = "",
        size: str = "1024x1024"
    ) -> OpenAIImageObject:
        """
        Alias for generate_metal_swatch, supporting background celery task interface.
        """
        return self.generate_metal_swatch(
            base_image_source=base_image_source,
            metal=metal,
            user_prompt=user_prompt,
            jewellery_type=jewellery_type,
            size=size
        )


    def generate_image_from_prompt(
        self,
        user_prompt: str,
        size: str = "1024x1024"
    ) -> OpenAIImageObject:
        """
        Generate image using prompt only (no reference image) via OpenAI Pipeline.
        """
        logger.info("Generating prompt-only image using OpenAI Pipeline")
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
        image_source: str | list[str],
        user_request: str,
    ) -> dict:
        """
        Analyze changes using GPT-4o-mini vision. Supports multiple reference images.
        """
        logger.info("Analyzing changes with vision for request: %s", user_request)
        try:
            sources = image_source if isinstance(image_source, list) else [image_source]
            image_contents = []
            for src in sources:
                if src:
                    img_bytes = self._load_image_bytes_from_source(src)
                    base64_img = self._encode_image_to_base64(img_bytes)
                    image_contents.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{base64_img}"
                        }
                    })

            client = self._client
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a master jewelry designer analyzing images for modifications. Examine the reference jewelry image(s) carefully, parse the user's modification request, identify EXACTLY what needs to change, specify what must remain unchanged, and note any complex elements. Respond ONLY with raw JSON structure."
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Analyze these jewelry reference image(s) and the user's request: '{user_request}'\n\nProvide a detailed JSON analysis of what needs to change and what must be preserved with fields: changes_needed, must_preserve, complex_elements, metal_type, stone_type, design_style."
                            }
                        ] + image_contents
                    }
                ],
                response_format={"type": "json_object"},
                timeout=25,
            )
            analysis = resp.choices[0].message.content or ""
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
        Compare generated image with requirements and identify issues using GPT-4o-mini vision.
        """
        logger.info("Comparing and validating generated image")
        try:
            base_bytes = self._load_image_bytes_from_source(base_image_source)
            generated_bytes = self._load_image_bytes_from_source(generated_image_source)

            base64_base = self._encode_image_to_base64(base_bytes)
            base64_generated = self._encode_image_to_base64(generated_bytes)

            changes_text = ", ".join(analysis.get("changes_needed", []))

            client = self._client
            resp = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
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
                response_format={"type": "json_object"},
                timeout=25,
            )
            comparison_text = resp.choices[0].message.content or ""
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
