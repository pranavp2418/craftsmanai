"""
Celery task for generating viewing angles per metal type for a design variant.

The task accepts a list of metals (e.g. ``["gold", "silver", "rose"]``).
For each metal it generates all standard viewing angles (side_view, top_view,
three_quarter_view) using the variant's base image as reference.  The results
are stored as a nested dict under ``angles_json``:

.. code-block:: json

    {
      "gold": {
        "side_view": "https://...",
        "top_view": "https://...",
        "three_quarter_view": "https://..."
      },
      "silver": { ... },
      "rose": { ... }
    }
"""

from __future__ import annotations

import base64
import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import requests

from app.core.database import SessionLocal
from app.models.design import Design
from app.repositories.design_variant import DesignVariantRepository
from app.repositories.activity_log import DesignActivityLogRepository
from app.services.openai_service import openai_service, generate_with_openai_image, generate_primary_image, download_reference_images
from app.services.storage_service import _validate_image_bytes, upload_image_to_supabase
from app.core.sse_manager import sse_manager
from app.tasks.base import create_task

logger = logging.getLogger(__name__)


# Old verbose master prompt removed — ultra-minimal prompts work better with gpt-image-2


METAL_DESCRIPTIONS = {
    "gold": "light, soft, true 10K CAD-style yellow gold (a lighter realistic gold, not a bright glossy yellow)",
    "yellow_gold": "light, soft, true 10K CAD-style yellow gold (a lighter realistic gold, not a bright glossy yellow)",
    "white_gold": "bright white gold / platinum with cool silver tones",
    "rose_gold": "warm rose gold with soft pink-copper tones",
    "rose": "warm rose gold with soft pink-copper tones",
    "silver": "bright white gold / platinum with cool silver tones",
    "platinum": "bright white lustre with a slightly matte luxury finish",
}


VIEW_PROMPTS = {
    "side_view": "slightly turned view — rotate the piece only about 10 degrees from straight front (a very subtle turn that just hints at the side depth/thickness). This is NOT a full side profile; the front face must still be clearly visible, almost front-on, just gently angled by ~10 degrees",
    "back_view": "rear / back view shown with a SOLID, smooth, closed, polished metal back (a solid filled back finish) — clean solid metalwork, NOT open gallery work, NOT hollow under-settings or cut-outs",
    "worn_view": "worn on a real person",
}

# The exact set of angles produced when the user requests more angles:
# one side view, one back view, and one wearable (worn) view.
ANGLE_VIEWS = ["side_view", "back_view", "worn_view"]


def _detect_piece_type(type_text: str) -> str:
    """Canonical piece type from jewellery_type + prompt text combined.

    Mirrors the shared profiles.resolve_profile ordering & coverage so the angle views match the
    base render. Order matters: check 'earring'/'cufflink' before 'ring' (both contain 'ring'). Uses
    word boundaries so 'bring'/'spring'/'string' don't false-match 'ring'. Unmatched / 'Custom' types
    resolve to 'custom' — they must NOT fall back to 'pendant', which rendered rings, cufflinks,
    brooches, buckles, chains etc. with a neck-worn pendant side/back/worn view.
    """
    t = (type_text or "").lower()
    if re.search(r"\bear[\s-]?rings?\b", t) or "earring" in t:
        return "earring"
    if re.search(r"\bcuff[\s-]?links?\b", t):
        return "cufflink"
    if re.search(r"\brings?\b", t):
        return "ring"
    if re.search(r"\b(bracelet|bangle)\b", t) or re.search(r"\bcuff\b", t):
        return "bracelet"
    if re.search(r"\banklet\b", t):
        return "anklet"
    if re.search(r"\b(grill|grillz)\b", t):
        return "grill"
    if re.search(r"\bwatch\b", t):
        return "watch"
    if re.search(r"\bbrooch\b", t):
        return "brooch"
    if re.search(r"\bbuckle\b", t):
        return "buckle"
    if re.search(r"\bclasp\b", t):
        return "clasp"
    if re.search(r"\bbail\b", t):
        return "bail"
    if re.search(r"\bbody\b", t):
        return "body"
    if re.search(r"\b(chain|necklace|choker)\b", t):
        return "necklace"
    if re.search(r"\b(pendant|charm)\b", t):
        return "pendant"
    return "custom"


# ONLY pieces with a CLEAR, ICONIC worn form the image model can reliably render (finger / wrist / ear /
# neck / teeth). Cufflink, brooch, buckle and body jewelry are deliberately EXCLUDED: the model ignores
# their real worn context ("cufflink on a shirt cuff") and forces them into a neck PENDANT no matter how
# explicit the prompt — so for those we show a clean studio product shot instead (see _NO_WORN).
_WORN_BODYPART = {
    "ring": "worn on a person's finger",
    "bracelet": "worn on a person's wrist",
    "anklet": "worn on a person's ankle",
    "earring": "worn on a person's ear",
    "grill": "worn on a person's teeth",
    "watch": "worn on a person's wrist",
    "pendant": "worn around a person's neck on the chain, resting naturally on the chest",
    "necklace": "worn around a person's neck, resting naturally on the collarbone/chest",
}

# Pure components / sets / generic custom have no single on-body shot — their wearable view becomes a clean
# studio product hero shot. (cufflink / brooch / buckle / body DO get on-body views via dedicated scene-first
# branches in _build_angle_variant_prompt, so they're intentionally NOT here.)
_NO_WORN = {"custom", "set", "clasp", "bail"}

# Flat name / design pieces whose BACK is essentially the front seen in reverse — for these the back view is a
# true MIRROR FLIP (words read backwards), which the client explicitly wants. Every OTHER type has a distinct
# mechanical back (cufflink swivel, ring band, earring posts, brooch pin, buckle prong…) so it must be MODEL-
# rendered, not flipped (a flip would wrongly show a mirrored FRONT).
_FLIP_BACK_PIECES = {"pendant", "necklace"}


def _resolve_piece(jewellery_type: str, type_text: str, piece_override: str = "") -> str:
    """Canonical piece type for the angle views. The user's EXPLICIT jewellery_type WINS — a selected
    'Cufflink'/'Ring'/'Brooch' is never overridden to 'pendant' by the base-image vision. Only a generic /
    blank / 'Custom' type falls back to the vision-detected piece_override, then to prompt-text detection."""
    jt_lower = (jewellery_type or "").strip().lower()
    type_is_generic = (not jt_lower) or jt_lower in ("custom", "jewelry", "jewellery", "other", "piece")
    if not type_is_generic:
        return _detect_piece_type(f"{jewellery_type} {type_text}")
    piece = (piece_override or "").strip().lower()
    if piece not in _WORN_BODYPART and piece not in _NO_WORN:
        piece = _detect_piece_type(f"{type_text} {jewellery_type}")
    return piece


def _worn_instruction(type_text: str) -> str:
    """Type-aware instruction for the wearable view (ring on finger, pendant on neck, etc.).

    *type_text* should be jewellery_type + the design prompt combined, so a generic
    jewellery_type like 'Custom' still resolves correctly via the prompt.
    """
    return _WORN_BODYPART.get(_detect_piece_type(type_text), _WORN_BODYPART["pendant"])


def _flip_horizontal(image_bytes: bytes) -> bytes:
    """Mirror an image left-to-right — a TRUE front-to-back flip: any words/lettering read MIRRORED and the
    whole layout is reversed. Used to build the BACK view deterministically (always a correct mirror of the
    front), instead of asking the model to 'imagine' the reverse."""
    from PIL import Image, ImageOps
    import io
    im = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    buf = io.BytesIO()
    ImageOps.mirror(im).save(buf, "PNG")
    return buf.getvalue()


def _front_recolor_prompt(metal: str) -> str:
    """Prompt to recolour the FRONT view to a target metal WITHOUT changing the angle/design — used before
    flipping, when the reference isn't already in the requested metal."""
    md = METAL_DESCRIPTIONS.get(metal, f"{metal.replace('_', ' ').title()} metal with a high-polish finish")
    return (f"Show this EXACT same piece from the SAME front-facing view as the reference — identical design, "
            f"shape, proportions, stones and every detail — but rendered in {md}. Do NOT change the camera angle "
            f"or the design in any way; ONLY change the metal colour/finish. Clean CAD-style 3D jewelry render, "
            f"crisp and sharp, even studio lighting, pure solid white background (#FFFFFF). One image only.")


# ---------------------------------------------------------------------------
# Angle / metal-variant prompt — a FAITHFUL PORT of the Lovable prototype's
# generate-variant edge function (CRAFTSMAN_MASTER_SYSTEM_PROMPT + buildVariantPrompt
# + subtypeAngleHints + VIEW_PROMPTS). Same model (gemini-3.1-flash-image-preview).
# The BACK view is a MODEL-rendered subtype-correct rear (NOT a programmatic flip),
# exactly like Lovable — the client wants angles "same to same" as Lovable.
# ---------------------------------------------------------------------------
_CRAFTSMAN_MASTER = (
    "CraftsmanAI Master Jewelry Render Controller - DERIVED-ANGLE / METAL-SWAP MODE.\n\n"
    "You are NOT a generic image generator. You are a controlled jewelry render engine. In this mode you are "
    "ONLY rotating the camera or swapping metal color on an ALREADY-APPROVED hero render. You are NEVER "
    "redesigning.\n\n"
    "MISSION: preserve input intent, preserve subtype accuracy, preserve reference identity, avoid "
    "hallucination, generate approval-ready variants for jewelry retailers.\n\n"
    "PRIORITY ORDER: structural accuracy -> subtype fidelity -> preservation of the approved hero's identity -> "
    "realistic manufacturable jewelry logic -> controlled minimal change.\n\n"
    "RENDER STYLE (always): CAD-styled jewelry render, realistic and premium, crisp, structurally clear, "
    "practically manufacturable, PURE WHITE (#FFFFFF) seamless background with NO cast/ground/contact shadow, "
    "NO gradient floor, NO reflection plate, symmetry-preserving, soft uniform studio lighting, approval-ready.\n\n"
    "PRECISION-CRITICAL ELEMENTS (preserve exactly, never distort): names, initials, monograms, logos, "
    "engraving, class years, custom lettering - identical shape, spelling, alignment, proportion, edge sharpness.\n\n"
    "HARD CONSTRAINTS: no hallucinated components, no subtype drift, no extra ornaments, no melted geometry, no "
    "floating stones, no impossible prongs, no warped engravings, no broken chain logic, no distorted typography, "
    "no random asymmetry (unless the hero already has it), no non-manufacturable structures, no invented backside "
    "engraving or hidden geometry. If hidden geometry is ambiguous, use conservative subtype defaults - never invent.\n\n"
    "NO-DEFAULT-TEXT RULE (CRITICAL): NEVER add, engrave, stamp, etch, or emboss any text, letters, numbers, "
    "monograms, brand names, watermarks, signatures, or logos onto the piece, packaging, or background UNLESS that "
    "exact text is already present in the approved hero render (in which case preserve it verbatim). If the approved "
    "hero has no engraved text, the variant must have no engraved text.\n\n"
    "FINAL VALIDATION: type correct? subtype correct? hero identity preserved? text/logo exact? stone/metal logic "
    "realistic? CAD-styled? approval-ready? If any answer is NO, correct before finalizing."
)

_VIEW_DESCRIPTIONS = {
    "side": ("TRUE SIDE PROFILE rotation of the EXACT same object - reveal real thickness, shank/bail/gallery "
             "height, prong elevation, and side construction. This is a camera rotation, NOT a reimagined design."),
    "back": ("REAR VIEW of the EXACT same object - show the actual back-plate construction implied by the front "
             "geometry. Use subtype-correct rear logic only. Do NOT invent cutouts, engraving, or openings not "
             "implied by the front."),
    "worn": ("WORN view: place the EXACT same approved object naturally on the appropriate body area (neck for "
             "pendants/chains, hand for rings, ear for earrings, wrist for bracelets/watches, teeth for grillz). "
             "Object geometry, proportions, stones, text, and metal must remain identical to the approved hero "
             "render. No redesign."),
}


def _subtype_angle_hints(item_type: str, view_type: str) -> str:
    """Faithful port of Lovable's subtypeAngleHints - subtype-correct rear/side/worn templates so derived
    angles don't hallucinate hidden geometry. (cufflink/brooch/buckle worn entries added so they aren't
    forced into a neck pendant - Lovable gates those on the frontend instead.)"""
    t = (item_type or "").lower()
    is_chain_like = ("necklace" in t) or ("chain" in t) or ("bracelet" in t)
    if view_type == "back":
        if "pendant" in t:
            return ("Back: solid or lightly recessed back plate matching the front silhouette exactly. Bail visible "
                    "at top in correct orientation. No new engraving, no new openings.")
        if "ring" in t:
            return ("Back: continuous inner band, underside openness consistent with subtype (open gallery for prong "
                    "settings, closed for signet/class style). No extra cutouts.")
        if is_chain_like:
            return ("Back: same link pattern continues identically - Cuban stays Cuban, Figaro ratio preserved, Rope "
                    "twist consistent, Tennis spacing/prong rhythm preserved. Same link count.")
        if "earring" in t:
            return "Back: post/clutch or hoop closure mechanism appropriate to subtype. Mirror-symmetric to front silhouette."
        if "grill" in t:
            return "Back: tooth-cap interior surface, same tooth count and arch curvature as front. No invented teeth."
        if "watch" in t:
            return "Back: case back appropriate to watch subtype, same case diameter and lug structure."
        if "cufflink" in t:
            return "Back: cufflink swivel/toggle bar mechanism on a solid reverse plate. No invented openings."
        if "brooch" in t:
            return "Back: pin stem and catch/clasp mechanism on a solid reverse plate."
        if "buckle" in t:
            return "Back: buckle prong and bar mechanism on a solid reverse plate."
    if view_type == "side":
        if "pendant" in t:
            return ("Side: reveal pendant thickness, bail orientation, frame/border depth, stone wall height. "
                    "Silhouette outline must match front exactly when rotated.")
        if "ring" in t:
            return ("Side: preserve shank thickness, head height, shoulder taper, gallery/prong structure. For "
                    "signet/class-style preserve flat planar face thickness.")
        if is_chain_like:
            return "Side: link profile and thickness preserved, pattern rhythm unchanged."
        if "grill" in t:
            return "Side: arch curvature and gumline fit preserved, same tooth separation style."
        if "watch" in t:
            return "Side: case profile, bezel coverage, crown placement, lug geometry preserved."
    if view_type == "worn":
        if "pendant" in t:
            return "Worn: on neck via chain, pendant hanging naturally at chest. Object identical to approved hero."
        if "ring" in t:
            return "Worn: on finger, hero face oriented toward camera. Identical geometry."
        if "earring" in t:
            return "Worn: on ear, identical geometry."
        if "bracelet" in t or "necklace" in t or "chain" in t:
            return "Worn: on wrist/neck, link pattern and clasp identical."
        if "grill" in t:
            return "Worn: on teeth, tooth count and arch identical to approved."
        if "watch" in t:
            return "Worn: on wrist, case and bracelet identical to approved."
        if "body" in t:
            return "Worn: appropriate body placement (nose/septum/navel/etc), hardware identical to approved."
        if "cufflink" in t:
            return "Worn: fastened through a man's white dress-shirt cuff, identical geometry. NOT a neck pendant, no chain."
        if "brooch" in t:
            return "Worn: pinned on a jacket lapel/garment, identical geometry. NOT a neck pendant, no chain."
        if "buckle" in t:
            return "Worn: on a leather belt at the waist, identical geometry. NOT a neck pendant, no chain."
    return ""


def _build_angle_variant_prompt(angle_name: str, metal: str, jewellery_type: str = "pendant", recolor: bool = True, type_text: str = "", piece_override: str = "") -> str:
    """FAITHFUL port of the Lovable prototype's buildVariantPrompt + CRAFTSMAN master controller. Returns ONE
    combined text prompt (master + structured derived-angle prompt) that is sent together with the hero image -
    exactly like Lovable. The back view is a MODEL-rendered subtype-correct rear (no programmatic flip).

    recolor=False: the reference is already the correct metal - keep colour, only rotate the camera.
    recolor=True:  recolour to `metal` while rotating.
    """
    piece = _resolve_piece(jewellery_type, type_text, piece_override)
    # Map to the Lovable canonical labels used by the subtype hints.
    canonical = {"grill": "grillz", "body": "body_jewelry"}.get(piece, piece)
    jt_label = (jewellery_type or "").strip() or piece

    view_type = "worn" if "worn" in angle_name else ("back" if "back" in angle_name else "side")
    view_desc = _VIEW_DESCRIPTIONS.get(view_type, _VIEW_DESCRIPTIONS["side"])
    metal_desc = METAL_DESCRIPTIONS.get(metal, f"{metal.replace('_', ' ').title()} metal with a high-polish finish")

    if recolor:
        instruction = (f"Generate a {view_desc} of the EXACT same piece rendered in {metal_desc}. Preserve the "
                       "identical design: same silhouette, stone arrangement, prong/setting logic, text/logo, "
                       "border/frame, bail/head/shank structure. Only the viewpoint and metal color change.")
        metal_preserve = ""
    else:
        instruction = (f"Generate a {view_desc} of the EXACT same piece. Preserve the identical design: same "
                       "silhouette, stone arrangement, prong/setting logic, text/logo, border/frame, "
                       "bail/head/shank structure. Only the camera angle changes.")
        metal_preserve = ", metal color"

    # Manufacturing reference views must show the SAME piece from every angle — the model otherwise drifts
    # (drops icing to plain metal on rotation). Demand identical stone coverage across the view set.
    instruction += (" CRITICAL - match the hero's STONE COVERAGE exactly: every diamond / pave-set surface on the "
                    "approved hero stays FULLY set in this view (never turn an iced surface into plain metal, never "
                    "add or thin stones); identical stone count, size and density on every visible face.")

    angle_hints = _subtype_angle_hints(canonical, view_type)
    angle_block = f"SUBTYPE ANGLE TEMPLATE:\n{angle_hints}\n\n" if angle_hints else ""
    house_first = ("- Worn view: object on body naturally, but the object itself is identical to the hero"
                   if view_type == "worn"
                   else "- Isolated jewelry on clean white / very light neutral background")

    variant_prompt = (
        "You are CraftsmanAI's derived-angle render engine. You are NOT designing a new piece.\n"
        "You are generating a SUPPORT ANGLE of an ALREADY APPROVED hero render (attached as the first image). "
        "The approved hero IS THE MASTER GEOMETRY TRUTH.\n\n"
        "LOCKED DESIGN STATE - DO NOT MODIFY:\n"
        f"- Item type: {jt_label} (canonical: {canonical})\n\n"
        "VARIANT INSTRUCTION:\n"
        f"{instruction}\n\n"
        f"{angle_block}"
        "DERIVED-ANGLE PRESERVATION RULES (mandatory):\n"
        "- The attached hero render is the ABSOLUTE SOURCE OF TRUTH. Treat it as a 3D object you are merely "
        "rotating or placing.\n"
        "- Preserve EXACTLY: subtype, silhouette, proportions, thickness, stone count, stone arrangement, "
        f"prong/setting logic, text/logo geometry, border/frame, bail/clasp/head/shank structure{metal_preserve}.\n"
        "- Do NOT redesign, reinterpret, or 'improve' any part.\n"
        "- Do NOT add or remove stones, letters, dates, icons, cutouts, or decorative elements.\n"
        "- Do NOT alter link count (chains/bracelets), tooth count (grillz), or stone row count.\n"
        "- Stone topology must match the hero exactly when projected to the new angle.\n"
        "- If hidden geometry is ambiguous, use CONSERVATIVE subtype-template defaults - do NOT invent.\n\n"
        "CRAFTSMAN HOUSE STYLE:\n"
        f"{house_first}\n"
        "- CAD-styled approval render\n"
        "- Centered composition\n"
        "- Crisp, premium, production-review friendly\n"
        "- Symmetric where the hero is symmetric\n\n"
        "ANTI-HALLUCINATION RULES:\n"
        "- No melted prongs, no floating stones, no fused metal blobs\n"
        "- No fake glitter, no generic diamond grids\n"
        "- No invented backside engraving, no invented openings\n"
        "- Preserve negative space and edge crispness\n\n"
        "HARD NEGATIVE CONSTRAINTS (mandatory - never violate):\n"
        "- Do NOT introduce hallucinated elements\n"
        "- Do NOT change subtype\n"
        "- Do NOT add extra stones, extra links, extra layers, extra motifs, or random decorative details\n"
        "- Do NOT distort lettering, numbers, logos, monograms, or engraving\n"
        "- Do NOT melt metal edges\n"
        "- Do NOT create floating stones or impossible prong placements\n"
        "- Do NOT break chain rhythm or clasp logic\n"
        "- Do NOT produce asymmetrical layout unless the hero is intentionally asymmetric\n\n"
        "One image only."
    )
    return f"{_CRAFTSMAN_MASTER}\n\n{variant_prompt}"


# ---------------------------------------------------------------------------
# MULTI-VIEW angle generation (the client's idea): generate ALL views of a piece in ONE image/context
# (a 2x2 grid: front / side / back / worn of the SAME piece) and CROP it into the separate views. Because
# the model draws all four together in one pass, they are mutually CONSISTENT — no per-angle drift (the old
# approach re-imagined each angle separately and dropped icing / changed the design). DB shape is unchanged:
# the base stays the front, and the side/back/worn crops become angles_json.
# ---------------------------------------------------------------------------
_MV_WORN = {
    "pendant": "worn on a person's neck on a chain, resting on the chest",
    "necklace": "worn on a person's neck",
    "ring": "worn on a person's finger",
    "earring": "worn on a person's ear",
    "bracelet": "worn on a person's wrist",
    "anklet": "worn on a person's ankle",
    "watch": "worn on a person's wrist",
    "grill": "worn on a person's teeth",
    "cufflink": "fastened on a man's white dress-shirt cuff (NOT a neck pendant)",
    "brooch": "pinned on a jacket lapel (NOT a neck pendant)",
    "buckle": "on a leather belt at the waist (NOT a neck pendant)",
    "body": "worn on the relevant pierced body area (NOT a neck pendant)",
}
_MV_BACK = {
    "pendant": "a SOLID polished metal back plate (any lettering MIRRORED / reversed), the bail visible at top, NO stones on the back",
    "necklace": "a solid metal back / clasp, no stones",
    "ring": "the continuous inner band / shank seen from behind",
    "earring": "the posts & butterfly clutches",
    "bracelet": "the reverse of the links and the clasp",
    "watch": "the case back",
    "grill": "the tooth-cap interior surface",
    "cufflink": "the swivel / toggle bar mechanism on a solid reverse plate",
    "brooch": "the pin stem & catch on a solid reverse plate",
    "buckle": "the prong & bar mechanism on a solid reverse plate",
}


def _build_multiview_prompt(piece: str, jt_label: str, metal_name: str, recolor: bool) -> str:
    """Prompt for a single 2x2 multi-view sheet (front / side / back / worn) of the SAME piece."""
    worn = _MV_WORN.get(piece, "worn on a person in the natural way for this kind of piece")
    back = _MV_BACK.get(piece, "the solid metal reverse of the piece with its real findings / mechanism")
    if recolor:
        metal_desc = METAL_DESCRIPTIONS.get(metal_name, f"{metal_name.replace('_', ' ').title()} metal")
        metal_clause = f", ALL rendered in {metal_desc}"
    else:
        metal_clause = ", keeping the EXACT same metal colour / finish as the attached reference"
    return (
        "IMPORTANT - RENDER ZERO TEXT: do NOT write any words, panel titles, captions, labels or annotations "
        "anywhere in this image. The ONLY lettering allowed is the jewelry's OWN design on the piece itself.\n\n"
        f"You are given the approved render of a {jt_label} (attached). Produce ONE clean image on a pure white "
        f"background (#FFFFFF), split into a 2x2 grid of four equal panels - EVERY panel is the SAME EXACT piece "
        f"(identical design, lettering, stones, proportions){metal_clause}:\n"
        "- Top-left: the piece straight-on, its decorated face toward the camera (same as the attached reference).\n"
        "- Top-right: the SAME piece rotated about 45 degrees to reveal its thickness and side depth, with the "
        "decorated face fully visible and its EXACT surface finish preserved.\n"
        f"- Bottom-left: the SAME piece seen from its reverse - {back}.\n"
        f"- Bottom-right: the SAME piece {worn}.\n"
        "Every panel is the SAME EXACT piece - keep the EXACT SAME SURFACE FINISH as the reference: if an area is "
        "stone-set / diamond-set keep it fully set, and if an area is PLAIN polished metal keep it plain. Do NOT ADD "
        "any stones/diamonds where the reference has none, and do NOT REMOVE stones where it has them. Identical "
        "design, lettering, proportions and metal colour. CAD-style realistic jewelry render, crisp, even studio "
        "lighting. The first three panels on pure white; only the last panel shows a person. NO text, captions, "
        "titles, grid lines or borders anywhere - only the jewelry."
    )


def _crop_quadrants(image_bytes: bytes) -> dict:
    """Split a (near-)square 2x2-grid multi-view image into its four panels (PNG bytes)."""
    from PIL import Image
    import io
    im = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    W, H = im.size
    hw, hh = W // 2, H // 2

    def _b(box):
        buf = io.BytesIO()
        im.crop(box).save(buf, "PNG")
        return buf.getvalue()

    return {
        "front": _b((0, 0, hw, hh)),
        "side_view": _b((hw, 0, W, hh)),
        "back_view": _b((0, hh, hw, H)),
        "worn_view": _b((hw, hh, W, H)),
    }


def _extract_image_data(data_item: Any) -> tuple[bytes, str]:
    if getattr(data_item, "b64_json", None):
        return base64.b64decode(data_item.b64_json), "image/png"
    if isinstance(data_item, dict) and data_item.get("b64_json"):
        return base64.b64decode(data_item["b64_json"]), "image/png"

    url = getattr(data_item, "url", None) or (
        data_item.get("url") if isinstance(data_item, dict) else None
    )
    if url:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "").split(";")[0].strip()
        return resp.content, content_type or "image/png"

    raise ValueError("OpenAI response did not contain image bytes or URL.")


@create_task(name="generate_remaining_variant_angles", max_retries=3)
def generate_remaining_variant_angles(self, variant_id: int, metals: list[str], channel: str):
    """Generate viewing angles for each requested metal for *variant_id*.

    The Celery task runs in a separate worker process.  Results are published
    as SSE events on *channel* when generation is complete (or fails).
    """
    logger.info(
        "Starting per-metal angle generation for variant_id=%s, metals=%s",
        variant_id,
        metals,
    )
    db = SessionLocal()

    try:
        variant_repo = DesignVariantRepository(db)
        activity_repo = DesignActivityLogRepository(db)

        variant = variant_repo.get_by_id(variant_id)
        if not variant:
            raise ValueError(f"DesignVariant with id {variant_id} not found")

        if not variant.base_design_image_url:
            raise ValueError(f"Variant {variant_id} has no base image URL")

        # Look up jewellery_type from the associated Design. jewellery_type is often a
        # generic 'Custom', so also carry the design prompt — the worn view uses it to tell a
        # ring (finger) from a pendant (neck).
        design = db.query(Design).filter(Design.id == variant.design_id).first()
        jewellery_type = design.jewellery_type if design else ""
        type_text = (design.user_prompt if design else "") or ""

        # Detect the piece TYPE from the ACTUAL base image via vision (reliable even when
        # jewellery_type is 'Custom' and the prompt is empty). Used for the worn view so a
        # ring is worn on a finger, not the neck. Falls back to text detection on failure.
        worn_piece_type = ""
        try:
            from app.services.openai_service import detect_jewelry_piece_type
            _braw = requests.get(variant.base_design_image_url, timeout=20).content
            worn_piece_type = detect_jewelry_piece_type(base64.b64encode(_braw).decode("utf-8"))
            logger.info("Piece type detected as '%s' for variant_id=%s", worn_piece_type, variant_id)
        except Exception as _pt_err:
            logger.warning("Piece-type vision detect failed for variant_id=%s: %s", variant_id, _pt_err)

        # Build nested angles_json: keys are metal names, values are angle dicts
        existing_angles = variant.angles_json or {}
        generated_angles: dict[str, dict[str, str]] = {}

        # Preserve ALL existing metals that were NOT requested (never remove old data)
        for existing_metal, existing_metal_data in existing_angles.items():
            if existing_metal not in metals:
                generated_angles[existing_metal] = existing_metal_data

        # Determine which requested metals already have all angles (skip regeneration)
        already_existing = []
        for metal_name in metals:
            metal_data = existing_angles.get(metal_name)
            if isinstance(metal_data, dict) and all(
                angle in metal_data for angle in ANGLE_VIEWS
            ):
                already_existing.append(metal_name)
                generated_angles[metal_name] = metal_data

        missing_metals = [m for m in metals if m not in already_existing]

        if already_existing:
            logger.info(
                "Skipping already-existing angle metals for variant_id=%s: %s",
                variant_id, already_existing,
            )

        if not missing_metals:
            sse_manager.publish(
                channel,
                data={
                    "variant_id": variant.id,
                    "design_id": variant.design_id,
                    "status": "SKIPPED",
                    "message": "All angles already exist for all requested metals",
                    "angles": generated_angles,
                },
                event="variant.angles.generated",
            )
            sse_manager.publish_close(channel)
            return

        # MULTI-VIEW generation (the client's idea): instead of 3 SEPARATE per-angle generations (which DRIFT
        # — each re-imagines the piece and drops icing / changes the design), generate ONE 2x2 multi-view sheet
        # per metal (front / side / back / worn of the SAME piece, in one context) and CROP it into the views.
        # All angles are then mutually CONSISTENT. The base stays as-is; we store the side/back/worn crops.
        # DB shape is unchanged (base + angles_json {side_view, back_view, worn_view}).
        metal_variations = variant.metal_variations_json or {}

        def _ref_for_metal(metal_name: str) -> tuple[str, bool]:
            url = metal_variations.get(metal_name)
            if url:
                return url, False  # correctly-colored reference → keep colour
            return variant.base_design_image_url, True  # fall back → recolor in the sheet

        # Pre-download each unique reference image ONCE (shared across threads)
        ref_blob_cache: dict[str, list[bytes]] = {}
        for metal_name in missing_metals:
            ref_url, _ = _ref_for_metal(metal_name)
            if ref_url not in ref_blob_cache:
                ref_blob_cache[ref_url] = download_reference_images([ref_url])

        _piece = _resolve_piece(jewellery_type, type_text, worn_piece_type)
        _jt_label = (jewellery_type or "").strip() or _piece

        def _generate_metal_angles(metal_name: str) -> tuple[str, dict]:
            """Generate ALL angle views for ONE metal from a SINGLE multi-view sheet, then crop. Returns
            (metal, {side_view: url, back_view: url, worn_view: url})."""
            out: dict[str, str] = {}
            try:
                ref_url, need_recolor = _ref_for_metal(metal_name)
                cached_blobs = ref_blob_cache.get(ref_url)
                prompt = _build_multiview_prompt(_piece, _jt_label, metal_name, need_recolor)
                # whiten_output=False — the worn panel has a person/background; never flood-fill the sheet.
                b64 = generate_primary_image([ref_url], prompt, pre_downloaded_blobs=cached_blobs, whiten_output=False)
                panels = _crop_quadrants(base64.b64decode(b64))
                for view in ("side_view", "back_view", "worn_view"):
                    try:
                        img_bytes = panels[view]
                        _validate_image_bytes(img_bytes, "image/png")
                        bucket_path = f"generated/angles/{variant.design_id}/{variant.id}/{metal_name}/{view}"
                        out[view] = upload_image_to_supabase(img_bytes, bucket_path)
                    except Exception as _ve:
                        logger.warning("multi-view crop upload failed %s/%s for variant_id=%s: %s", metal_name, view, variant_id, _ve)
                logger.info("Multi-view angles generated for metal=%s variant_id=%s: %s", metal_name, variant_id, list(out))
            except Exception as exc:
                logger.exception("Failed multi-view angles for metal=%s variant_id=%s: %s", metal_name, variant_id, exc)
            return metal_name, out

        # One multi-view generation per metal, in parallel.
        max_parallel = min(len(missing_metals), 5) or 1
        with ThreadPoolExecutor(max_workers=max_parallel) as executor:
            futures = {executor.submit(_generate_metal_angles, m): m for m in missing_metals}
            for future in as_completed(futures):
                metal_name, views = future.result()
                if metal_name not in generated_angles:
                    generated_angles[metal_name] = {}
                generated_angles[metal_name].update(views)

        # Merge back any metals that weren't requested but existed before
        for existing_metal, existing_metal_data in existing_angles.items():
            if existing_metal not in generated_angles:
                generated_angles[existing_metal] = existing_metal_data

        variant_repo.update_variant(variant, angles_json=generated_angles)
        activity_repo.log(
            design_id=variant.design_id,
            action_type="ANGLES_GENERATED",
            message=f"Generated angles for metals: {', '.join(missing_metals)}",
            metadata={
                "variant_id": variant.id,
                "metals": missing_metals,
            },
        )

        sse_manager.publish(
            channel,
            data={
                "variant_id": variant.id,
                "design_id": variant.design_id,
                "status": "GENERATED",
                "generated_metals": missing_metals,
                "angles": generated_angles,
            },
            event="variant.angles.generated",
        )

        sse_manager.publish_close(channel)

        logger.info(
            "Per-metal angle generation completed for variant_id=%s",
            variant_id,
        )

    except Exception as exc:
        logger.exception(
            "Per-metal angle generation failed for variant_id=%s: %s",
            variant_id,
            exc,
        )
        try:
            sse_manager.publish(
                channel,
                data={
                    "variant_id": variant_id,
                    "status": "FAILED",
                    "error": str(exc),
                },
                event="variant.angles.failed",
            )
            sse_manager.publish_close(channel)
        except Exception:
            logger.warning(
                "Failed to publish angle generation failure event for variant_id=%s",
                variant_id,
            )

        raise self.retry(
            exc=exc,
            countdown=60 * (2 ** self.request.retries),
            max_retries=3,
        )
    finally:
        db.close()