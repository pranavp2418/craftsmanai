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


def _build_angle_variant_prompt(angle_name: str, metal: str, jewellery_type: str = "pendant", recolor: bool = True, type_text: str = "", piece_override: str = "") -> str:
    """Build a concise angle variant prompt — minimal for best gpt-image-2 results.

    recolor=False (preferred): the reference image is ALREADY the correct metal color,
    so we keep the exact same color/design and ONLY change the viewing angle. This makes
    the angle match the base image the user is viewing.
    recolor=True (fallback): no correctly-colored reference exists, so we recolor to the
    requested metal while changing the angle.
    """
    metal_desc = METAL_DESCRIPTIONS.get(metal, f"{metal.replace('_', ' ').title()} metal with a high-polish finish")
    is_worn = "worn" in angle_name
    jt = jewellery_type or "jewelry piece"

    if recolor:
        color_clause = f", rendered in {metal_desc}"
        color_preserve = ""
        change_clause = "Only the viewing angle and metal color change"
    else:
        color_clause = ""
        color_preserve = " same EXACT metal color and finish as the reference,"
        change_clause = "ONLY the viewing angle changes — keep the exact same metal color, finish and design as the reference"

    # Resolve the piece type ONCE (used by both the worn and back views). The user's EXPLICIT
    # jewellery_type WINS over the base-image vision (a selected "Cufflink"/"Ring" is never flipped to
    # "pendant" just because its face looks square). See _resolve_piece.
    piece = _resolve_piece(jewellery_type, type_text, piece_override)
    is_neck_piece = piece in ("pendant", "necklace")
    # 'Band' pieces are worn around a body part and have NO bail/hook (ring, bracelet, etc.).
    is_band_piece = piece in ("ring", "bracelet", "anklet", "bangle", "watch")
    # Components / sets / generic custom have no on-body shot — never force them onto a neck/pendant.
    has_worn = piece in _WORN_BODYPART
    # Use the resolved piece word so the prompt says "ring"/"bracelet" instead of "Custom".
    worn_jt = piece if (jt == "jewelry piece" or (jewellery_type or "").strip().lower() in ("", "custom")) else jt

    stone_protection = (
        "\n\nCRITICAL STONE PROTECTION: Do NOT change the color, shape, position, or type of any gemstones. "
        "All gemstones (including clear diamonds and colored stones like green, red, pink, blue, etc.) must preserve their original color, vibrancy, saturation, and transparency exactly as seen in the reference image. "
        "Do NOT recolor, desaturate, or turn colored gems into white/silver or metal. "
        "Preserve the EXACT stone COUNT and FULL pavé / diamond coverage from the reference — do NOT drop, thin out, "
        "shrink, simplify, or replace any pavé or stones with plain/blank metal; every diamond visible on the piece "
        "must stay set, even when the piece appears smaller in a worn/lifestyle scene."
    )

    if is_worn:
        # SCENE-FIRST worn views — the model reflexively turns these into a neck pendant unless the body
        # SCENE leads the prompt (the piece becomes a detail WITHIN the scene), so we describe the scene
        # first and hard-exclude neck / chain / pendant. (cufflink → shirt cuff, brooch → lapel, etc.)
        if piece == "cufflink":
            return f"""A photorealistic editorial menswear close-up PHOTOGRAPH of a man's wrist and forearm wearing a crisp WHITE FRENCH-CUFF (double-cuff) dress shirt with the cuff folded back. A matching PAIR of these exact cufflinks{color_clause} fastens the shirt cuff — each cufflink pushed through the cuff buttonholes so its decorative face sits flat on the outside of the folded cuff. The shirt cuff and wrist FILL the frame. This is a CUFFLINK fastening a SHIRT CUFF: there is NO neck, NO chest, NO chain, NO bail and NO pendant anywhere in the image. Keep each cufflink's EXACT design, stones and metal{color_preserve} identical to the reference.{stone_protection}

Photorealistic lifestyle photograph, natural lighting, sharp focus on the cufflinks. One image only."""
        if piece == "brooch":
            return f"""A photorealistic close-up PHOTOGRAPH of this exact brooch{color_clause} PINNED to a person's tailored jacket LAPEL / coat, its pin clearly fastened through the fabric. The lapel, shoulder and garment FILL the frame. This is a BROOCH worn on clothing: NOT a necklace or pendant — there is NO chain, NO bail and NO bare neck or chest in the image. Keep the brooch's EXACT design, stones and metal{color_preserve} identical to the reference.{stone_protection}

Photorealistic lifestyle photograph, natural lighting, sharp focus on the brooch. One image only."""
        if piece == "buckle":
            return f"""A photorealistic close-up PHOTOGRAPH of a LEATHER BELT worn at the waist, this exact buckle{color_clause} at the centre fastening the belt with the leather strap threaded through it. The belt and buckle FILL the frame. This is a BELT BUCKLE: NOT a pendant — there is NO chain, NO bail and NO neck in the image. Keep the buckle's EXACT design, stones and metal{color_preserve} identical to the reference.{stone_protection}

Photorealistic lifestyle photograph, natural lighting, sharp focus on the buckle. One image only."""
        if piece == "body":
            return f"""A photorealistic close-up PHOTOGRAPH of this exact body-jewelry piece{color_clause} worn on the relevant pierced body area (real body jewelry / piercing). The piercing area FILLS the frame. It is NOT a neck pendant and has NO hanging chain or bail. Keep its EXACT design, stones and metal{color_preserve} identical to the reference.{stone_protection}

Photorealistic lifestyle photograph, natural lighting, sharp focus on the piece. One image only."""
        if not has_worn:
            # Pure components (clasp / bail), matching sets and generic 'custom' have no single on-body shot —
            # show a clean studio product hero shot instead of forcing them onto a neck as a pendant.
            return f"""Show this exact same {worn_jt}{color_clause} as a premium studio PRODUCT hero shot — a clean three-quarter beauty angle of the piece ITSELF on a pure solid white background (#FFFFFF). Do NOT place it on a person and do NOT turn it into a hanging pendant.{stone_protection}

Keep the EXACT same design, components, stones, engraving/text, shape, proportions, borders,{color_preserve} and all details identical to the reference. Only the camera angle changes; do not redesign or alter any part of the piece.

Clean CAD-style 3D jewelry render, sharp focus, even studio lighting. One image only."""
        worn_desc = _WORN_BODYPART[piece]
        chain_clause = ""
        if piece == "pendant":
            chain_clause = (
                " The necklace CHAIN must pass through the pendant's bail/hook at the top and the pendant must "
                "hang straight down from that chain, exactly the way a real necklace is worn — the chain clearly "
                "threaded through the bail and connected, resting evenly on both sides of the neck. The pendant "
                "must NOT float on its own; it hangs from the chain via its bail."
            )
        elif piece == "necklace":
            chain_clause = (
                " The necklace sits naturally around the neck and rests evenly on the collarbone/chest, clasped "
                "at the back — exactly the way a real necklace is worn. It is the chain / nameplate ITSELF; do NOT "
                "add a separate hanging pendant or a bail it does not have."
            )
        elif piece == "ring":
            chain_clause = (
                " The finger must pass THROUGH the ring's band/opening — the ring is worn ON the finger with the "
                "finger clearly INSIDE the band, sitting snugly at the base of the finger exactly like a real ring. "
                "Use correct, realistic ring proportions (a normal-sized ring; the band hugs the finger); the "
                "decorative top of the ring faces up on top of the finger. Do NOT make the ring oversized and do "
                "NOT just rest it on top of the finger — the finger goes through the band hole."
            )
        elif is_band_piece:
            chain_clause = (
                f" The {worn_jt} encircles the limb — the body part passes THROUGH the band/opening so the piece is "
                "worn around it like in real life, with correct realistic proportions. Do not just rest it on top."
            )
        return f"""Show this exact same {worn_jt}{color_clause}, {worn_desc} — a realistic lifestyle photo of the piece being worn.{chain_clause}{stone_protection}

Keep the EXACT same design, components, stones, engraving/text, shape, proportions, borders,{color_preserve} and all details identical to the reference. Only show it being worn; do not redesign or alter any part of the piece.

Photorealistic lifestyle photograph, natural lighting, the jewelry in sharp focus. One image only."""

    if "back" in angle_name:
        same_metal = metal_desc if recolor else "the same metal colour and finish as the reference"
        if is_band_piece:
            # A ring/bracelet is a solid band — its back is simply the reverse of the band and the
            # back of any motif. It has NO bail/hook/backplate; never add a hanging loop.
            ring_word = worn_jt or "ring"
            return f"""Show the BACK / REVERSE side of this exact same {ring_word} — rotate the piece to show the back of the band/shank and the BACK of the decorative motif (for example the back of the animal's head and body), in {same_metal}, on a pure solid white background (#FFFFFF) with NO background scene.{stone_protection}

It is a solid {ring_word} — a continuous band/shank. There is NO bail, NO hook, NO loop and NO backplate: do NOT add any hanging loop, hook, ring-clip or attachment of any kind. Simply show the same piece from behind — the smooth reverse of the band and the rear of the design. Keep the EXACT same shape, size, proportions and band thickness as the reference; only the viewing side changes.

Render it as a clean CAD-style 3D jewelry render (crisp, sharp, even studio lighting) — NOT a lifestyle photo, NOT a cartoon, no background scene. Pure solid white background (#FFFFFF).

One image only."""
        if is_neck_piece:
            # Pendant / necklace / nameplate: a real finished one has a SOLID closed metal back.
            return f"""Show the BACK / REVERSE side of this exact same {worn_jt} — as if you physically flipped the piece over front-to-back — in {same_metal}, on a pure solid white background (#FFFFFF) with NO background scene.{stone_protection}

This is the REVERSE side, NOT the front. By DEFAULT give it a SOLID, smooth, closed, polished metal BACK — a solid filled back finish covering the whole reverse, gently flat or softly domed, the way real finished name pendants / plates / charms are made. Do NOT show open-work, hollow gallery cut-outs, or the open backs of the stone settings; the back is a clean solid metal surface. Show the back of the bail/hook ONLY if the piece actually has one. Keep the SAME outer silhouette, proportions and structure as the front. The front design must NOT appear on the back: the name, numbers, lettering, motifs and any enamel/colour from the front must NOT be readable on the solid back (a subtle hidden maker's mark is fine, but no readable front design and no mirrored text).

Render it as a clean CAD-style 3D jewelry render (crisp, sharp, even studio lighting) — NOT a lifestyle photo, NOT a cartoon, no background scene. Pure solid white background (#FFFFFF).

One image only."""
        # Everything else (cufflink, brooch, buckle, earring, grill, body, set, custom, component):
        # show the TRUE reverse of THIS piece — never invent a pendant backplate / bail.
        return f"""Show the BACK / REAR of this exact same {worn_jt} in {same_metal}, on a pure solid white background (#FFFFFF) with NO background scene.{stone_protection}

Match the FRONT's framing EXACTLY: if the front shows a matching PAIR, show BOTH pieces from the back, side by side at the SAME size and position as the front — do NOT zoom into a single piece. Keep the SAME UPRIGHT orientation as the front: do NOT flip the piece upside-down — the toggle / findings stay on the SAME side as on the front. This is the REAR (the closure side), NOT the flat front face. On the back the functional LOCK is visible: for a cufflink the hinged SWIVEL / TOGGLE bar (flips to fasten the cuff); for an earring the posts & clutches or hoop closure; for a brooch the pin & catch; for a buckle the prong & bar. The rear gallery and the undersides of the pavé / diamonds ARE fine and expected — keep them visible (do NOT blank them out). Do NOT show the flat pavé FRONT FACE, and do NOT add a hanging bail / hook / loop or turn it into a pendant. Keep the SAME outer silhouette, proportions and structure as the front.

Render it as a clean CAD-style 3D jewelry render (crisp, sharp, even studio lighting) — NOT a lifestyle photo, no background scene. Pure solid white background (#FFFFFF).

One image only."""

    view_desc = VIEW_PROMPTS.get(angle_name, VIEW_PROMPTS.get("side_view"))
    return f"""Show this exact same {worn_jt} from a {view_desc}{color_clause}.{stone_protection}

Keep the exact same design, components, stones, engraving/text, shape, proportions, borders,{color_preserve} and all details. {change_clause} — do not redesign or alter any part of the piece.

Render it as a clean CAD-style 3D jewelry render (crisp, sharp, accurate metal and stones, even studio lighting) — NOT a lifestyle photo, NOT a cartoon, no background scene. Pure solid white background (#FFFFFF).

One image only."""


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

        # Build flat list of all (metal, angle) jobs to run in parallel.
        # Exactly three views per metal: side view, back view, and wearable (worn) view.
        angle_jobs: list[tuple[str, str]] = []
        for metal_name in missing_metals:
            for angle_name in ANGLE_VIEWS:
                angle_jobs.append((metal_name, angle_name))

        # For each metal, pick the correctly-colored reference so the angle MATCHES the
        # base image the user is viewing. If a metal-specific variant image exists, use it
        # and only rotate (no recolor). Otherwise fall back to the base image and recolor.
        metal_variations = variant.metal_variations_json or {}

        def _ref_for_metal(metal_name: str) -> tuple[str, bool]:
            url = metal_variations.get(metal_name)
            if url:
                return url, False  # correctly-colored reference → rotate only
            return variant.base_design_image_url, True  # fall back → recolor

        # Pre-download each unique reference image ONCE (shared across threads)
        ref_blob_cache: dict[str, list[bytes]] = {}
        for metal_name in missing_metals:
            ref_url, _ = _ref_for_metal(metal_name)
            if ref_url not in ref_blob_cache:
                ref_blob_cache[ref_url] = download_reference_images([ref_url])
        logger.info("Pre-downloaded %d unique reference image(s) for parallel angle generation", len(ref_blob_cache))

        def _generate_single_angle(metal_name: str, angle_name: str) -> tuple[str, str, str | None]:
            """Generate a single angle for a single metal. Returns (metal, angle, url or None)."""
            logger.info(
                "Generating %s for metal=%s, variant_id=%s",
                angle_name, metal_name, variant_id,
            )
            try:
                ref_url, need_recolor = _ref_for_metal(metal_name)
                cached_blobs = ref_blob_cache.get(ref_url)
                is_worn = "worn" in angle_name
                is_back = "back" in angle_name
                back_piece = _resolve_piece(jewellery_type, type_text, worn_piece_type) if is_back else ""
                if is_back and back_piece in _FLIP_BACK_PIECES:
                    # FLAT name / design piece (pendant / nameplate): the back IS the front in reverse, so make
                    # it a TRUE MIRROR FLIP (words read backwards) — deterministic, exactly what the client
                    # wants. If the reference isn't already in the requested metal, recolour the FRONT first
                    # (no angle change), then flip it.
                    if need_recolor:
                        front_b64 = generate_primary_image(
                            [ref_url], _front_recolor_prompt(metal_name),
                            pre_downloaded_blobs=cached_blobs, whiten_output=True,
                        )
                        front_bytes = base64.b64decode(front_b64)
                    else:
                        front_bytes = (cached_blobs or download_reference_images([ref_url]))[0]
                    image_bytes = _flip_horizontal(front_bytes)
                else:
                    # Side / worn for all types, AND the back for every piece with a distinct mechanical back
                    # (cufflink swivel, ring band, earring posts, brooch pin, buckle prong…) — MODEL-render the
                    # real subtype-correct view. A flip here would wrongly show a mirrored FRONT.
                    prompt = _build_angle_variant_prompt(angle_name, metal_name, jewellery_type, recolor=need_recolor, type_text=type_text, piece_override=worn_piece_type)
                    # Use the CONFIGURED provider (generate_primary_image respects settings.IMAGE_PROVIDER) so a
                    # Gemini-only deployment renders angles with Gemini too — instead of hard-calling OpenAI,
                    # which fails when OpenAI is unreachable/unset (the "api.openai.com" error). It still falls
                    # back to OpenAI only if Gemini fails AND OpenAI is configured. Worn view is a lifestyle
                    # photo with skin/background — do NOT white-flood-fill it (it would bleed into the photo).
                    b64_json = generate_primary_image(
                        [ref_url], prompt, pre_downloaded_blobs=cached_blobs, whiten_output=not is_worn,
                    )
                    image_bytes = base64.b64decode(b64_json)
                content_type = "image/png"
                _validate_image_bytes(image_bytes, content_type)

                bucket_path = (
                    f"generated/angles/{variant.design_id}/{variant.id}/"
                    f"{metal_name}/{angle_name}"
                )
                image_url = upload_image_to_supabase(image_bytes, bucket_path)
                logger.info(
                    "%s/%s generated for variant_id=%s: %s",
                    metal_name, angle_name, variant_id, image_url,
                )
                return metal_name, angle_name, image_url
            except Exception as exc:
                logger.exception(
                    "Failed to generate %s/%s for variant_id=%s: %s",
                    metal_name, angle_name, variant_id, exc,
                )
                return metal_name, angle_name, None

        # Run ALL angle+metal combinations in parallel (I/O-bound — waiting on OpenAI API)
        max_parallel = min(len(angle_jobs), 5)
        with ThreadPoolExecutor(max_workers=max_parallel) as executor:
            futures = {
                executor.submit(_generate_single_angle, metal, angle): (metal, angle)
                for metal, angle in angle_jobs
            }
            for future in as_completed(futures):
                metal_name, angle_name, image_url = future.result()
                if metal_name not in generated_angles:
                    generated_angles[metal_name] = {}
                if image_url:
                    generated_angles[metal_name][angle_name] = image_url

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