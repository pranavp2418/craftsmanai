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


