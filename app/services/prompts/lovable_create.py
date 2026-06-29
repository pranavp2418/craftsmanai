"""Lovable prototype VERBATIM create / generation-mode directives.

The MASTER is reused from `lovable_prompts.LOVABLE_REFINE_PROMPT` (its prefix, char 0..4264, ending at
"...correct the result before finalizing.\n\n"). Each generation-mode directive below is appended after the
master — exactly how Lovable assembles create prompts (master + the intent-specific generation block).

Placeholders (filled by `build_lovable_create`): {design_subject} {item_type} {metal_phrase} {stone_phrase}
{user_request} {components} {color_mapping} {sketch_annotations}. Any not provided resolve to "" — the same
as Lovable when those structured fields are empty. Edit the prototype, not paraphrases, to change these.
"""

from .lovable_prompts import LOVABLE_REFINE_PROMPT

# Lovable's master, sliced verbatim (single source of truth; index verified: char 4264 == "REFINEMENT MODE.").
LOVABLE_MASTER = LOVABLE_REFINE_PROMPT[:4264]


# (a) create WITH image — render_as_is (Lovable generate-render render_as_is block)
RENDER_AS_IS = """You are Craftsman.ai's jewelry render engine. The user has provided a jewelry reference image.

- Produce a 1-to-1 CAD-styled render of the SAME piece
- Preserve EXACTLY: metal color, structure, depth, outline, silhouette, layers, stone arrangement, stone orientation, border/frame logic, top/head/shank/bail/clasp shape
- Visually enhance ONLY in clarity, presentation, and cleanliness
- Do NOT redesign, do NOT "improve" by changing design language
- Do NOT enlarge stones, do NOT simplify structure, do NOT add elements
- This is a faithful reproduction, not a reinterpretation

Design subject: {design_subject}
Item type: {item_type}
Metal tone: {metal_phrase}
{components}{stone_phrase}
{user_request}
Generate ONE CAD-styled approval render (preserve the reference image's camera angle unless the user explicitly asked for a new angle) that is a faithful CAD-styled reproduction of this {item_type}."""


# (a') create WITH image — image_enhancement_only
IMAGE_ENHANCEMENT = """You are Craftsman.ai's jewelry render engine. This is an ENHANCEMENT-ONLY job, NOT a redesign.

ENHANCEMENT-ONLY RULES (mandatory):
- The user is NOT requesting a design change — only clarity, presentation, scale, or production polish
- Reproduce the SAME piece visually — same silhouette, same stones, same border, same font, same bail, same metal
- Improve only: image clarity, edge crispness, lighting, centering, background cleanup
- Do NOT alter style, border, font, stone pattern, layout, proportions, or structure
- Do NOT add or remove any element
- Treat this as a CAD-style "production view" of the existing piece

Item type: {item_type}
Metal tone: {metal_phrase}
{user_request}
Generate ONE CAD-styled approval render (preserve the reference image's camera angle unless the user explicitly asked for a new angle) that is a faithful, sharper, production-ready CAD reproduction of this {item_type}."""


# (b) create WITHOUT image — text_to_render
TEXT_TO_RENDER = """You are Craftsman.ai's jewelry render engine. Generate a jewelry piece from a text description only.

TEXT-TO-RENDER RULES:
- Produce a practical, physically believable jewelry piece
- Preserve manufacturable logic — this should look like something a jeweler can actually build
- Use small-to-mid sized stones by default — avoid chunky unrealistic defaults
- Favor realistic proportions and construction
- If the description is sparse, infer a clean simple design — do NOT overcomplicate

Design description: {user_request}
Item type: {item_type}
Metal tone: {metal_phrase}
{stone_phrase}
Generate ONE CAD-styled approval render of this {item_type}."""


# (c) sketch_to_render
SKETCH_TO_RENDER = """You are Craftsman.ai's jewelry render engine. Convert this hand-drawn sketch into a clean CAD-styled jewelry render.

SKETCH CONVERSION RULES:
- Preserve the drawn silhouette exactly
- Preserve the relative placement of all major components from the sketch
- Where the sketch shows rough stone outlines, convert to realistic stone placement using small-to-mid stones
- Where the sketch shows rough lettering, preserve letter structure as closely as possible
- Where arrows or annotations appear ({sketch_annotations}), obey them
- Where details are missing, infer conservatively — do NOT invent creative additions
- Do NOT add extra stones, halos, borders, or flourishes unless shown in the sketch
- Treat the sketch as the structural authority

Design subject: {design_subject}
Item type: {item_type}
Metal tone: {metal_phrase}
{components}{stone_phrase}
{user_request}
Generate ONE CAD-styled approval render of this {item_type} that faithfully represents the sketch."""


# (d) convert_to_jewelry (non-jewelry image -> jewelry)
CONVERT_TO_JEWELRY = """You are Craftsman.ai's jewelry render engine. Convert this non-jewelry image into a jewelry piece.

NON-JEWELRY CONVERSION RULES:
- Preserve the original structure, spacing, outline, negative space, and major visual relationships
- Convert the subject into jewelry in a practical, manufacturable way
- Map colored regions to appropriate gemstone/metal equivalents
- For B&W input, use sensible real-world jewelry color logic unless user specifies otherwise
- Use common-sense object-color defaults when appropriate
- Do NOT overcomplicate — do NOT randomly invent decorative structures unrelated to the input
- Do NOT add excessive embellishments unless requested

Design subject: {design_subject}
Item type: {item_type}
Metal tone: {metal_phrase}
{components}{stone_phrase}
{color_mapping}
{user_request}
Generate ONE CAD-styled approval render of this {item_type} converted from the reference."""


_FIELDS = ("design_subject", "item_type", "metal_phrase", "stone_phrase",
           "user_request", "components", "color_mapping", "sketch_annotations")


def build_lovable_create(directive: str, **fields) -> str:
    """Master (verbatim) + the selected Lovable generation directive, placeholders filled. Missing
    placeholders resolve to '' (same as Lovable when the structured field is empty)."""
    out = LOVABLE_MASTER + directive
    for k in _FIELDS:
        out = out.replace("{" + k + "}", str(fields.get(k, "") or ""))
    return out


def metal_phrase(has_images: bool, user_named_metal: bool, named_metal: str, intent: str = "") -> str:
    """Lovable metal policy: image+no-metal -> same_as_reference; sketch+no-metal -> same_as_reference;
    text-only / convert + no-metal -> yellow_gold_default; metal named -> that metal."""
    if user_named_metal:
        return named_metal or "the requested metal"
    if has_images and (intent or "").lower() in ("render_as_is", "image_enhancement_only", "sketch_to_render", ""):
        return "same_as_reference"
    return "yellow_gold_default"


# ===========================================================================
# PER-TYPE LAYER — Lovable JEWELRY_TAXONOMY + generate-render render-family rules + negative, ported
# verbatim. default_output_behavior strings are Lovable-verbatim (jewelry-taxonomy.ts).
# ===========================================================================
LOVABLE_TAXONOMY = {
    "pendant":  {"default_output_behavior": "Render pendant alone (no chain) unless explicitly requested.",
                 "render_family": "full_jewelry_piece", "default_angle_policy": "front_hero"},
    "ring":     {"default_output_behavior": "Render ring with proportions appropriate to subtype.",
                 "render_family": "full_jewelry_piece", "default_angle_policy": "front_hero"},
    "bracelet": {"default_output_behavior": "Render bracelet with appropriate link rhythm and clasp.",
                 "render_family": "full_jewelry_piece", "default_angle_policy": "front_hero"},
    "necklace": {"default_output_behavior": "Render necklace/chain with correct link pattern and clasp.",
                 "render_family": "full_jewelry_piece", "default_angle_policy": "front_hero"},
    "earring":  {"default_output_behavior": "Render earring(s) — mirror pair when relevant.",
                 "render_family": "full_jewelry_piece", "default_angle_policy": "front_hero"},
    "bail":     {"default_output_behavior": "Render the bail as a STANDALONE component. Do NOT attach a pendant unless asked.",
                 "render_family": "jewelry_component", "default_angle_policy": "isolated_product_view"},
    "clasp":    {"default_output_behavior": "Render the clasp/lock as a STANDALONE component. Do NOT attach a chain/bracelet unless asked.",
                 "render_family": "jewelry_component", "default_angle_policy": "isolated_product_view"},
    "grillz":   {"default_output_behavior": "Render grillz tooth caps with correct arch and tooth count.",
                 "render_family": "full_jewelry_piece", "default_angle_policy": "front_hero"},
    "watch":    {"default_output_behavior": "Render watch with realistic case, bezel, lugs, dial.",
                 "render_family": "full_jewelry_piece", "default_angle_policy": "front_hero"},
    "buckle":   {"default_output_behavior": "Render buckle as a standalone accessory piece.",
                 "render_family": "accessory_piece", "default_angle_policy": "isolated_product_view"},
    "brooch":   {"default_output_behavior": "Render brooch as a standalone accessory piece.",
                 "render_family": "accessory_piece", "default_angle_policy": "front_hero"},
    "cufflink": {"default_output_behavior": "Render cufflink (typically a matching pair).",
                 "render_family": "accessory_piece", "default_angle_policy": "front_hero"},
    "body_jewelry": {"default_output_behavior": "Render the body-jewelry piece with realistic piercing hardware.",
                 "render_family": "wearable_body_jewelry", "default_angle_policy": "isolated_product_view"},
    "set":      {"default_output_behavior": "Render multiple matching pieces in a coordinated layout; never merge into one object.",
                 "render_family": "matching_set", "default_angle_policy": "front_hero"},
    "custom_object": {"default_output_behavior": "Render the user-named custom object as a jewelry piece using the user-entered label as subject.",
                 "render_family": "custom_object", "default_angle_policy": "front_hero"},
}

_LOVABLE_ALIASES = {
    "pendant": "pendant", "charm": "pendant", "ring": "ring", "bracelet": "bracelet", "bangle": "bracelet",
    "necklace": "necklace", "chain": "necklace", "chains": "necklace", "choker": "necklace", "anklet": "necklace",
    "earring": "earring", "earrings": "earring", "bail": "bail", "clasp": "clasp", "lock": "clasp",
    "grillz": "grillz", "grill": "grillz", "grills": "grillz", "watch": "watch", "buckle": "buckle",
    "brooch": "brooch", "broach": "brooch", "cufflink": "cufflink", "cufflinks": "cufflink",
    "body jewelry": "body_jewelry", "body_jewelry": "body_jewelry", "body jewellery": "body_jewelry",
    "body": "body_jewelry", "set": "set", "matching set": "set",
    "custom": "custom_object", "custom object": "custom_object", "other": "custom_object",
}


def resolve_canonical_type(item_type: str) -> str:
    """Lovable resolveCanonicalType: null/empty/unknown -> 'custom_object'. Substring-tolerant
    (earring/cufflink before ring, like resolve_profile)."""
    t = (item_type or "").strip().lower()
    if not t:
        return "custom_object"
    if t in LOVABLE_TAXONOMY:
        return t
    if t in _LOVABLE_ALIASES:
        return _LOVABLE_ALIASES[t]
    for needle, canon in (("earring", "earring"), ("cufflink", "cufflink"), ("ring", "ring"),
                          ("bracelet", "bracelet"), ("necklace", "necklace"), ("chain", "necklace"),
                          ("grill", "grillz"), ("watch", "watch"), ("buckle", "buckle"), ("brooch", "brooch"),
                          ("clasp", "clasp"), ("bail", "bail"), ("body", "body_jewelry"),
                          ("pendant", "pendant"), ("charm", "pendant")):
        if needle in t:
            return canon
    if t.endswith("set"):
        return "set"
    return "custom_object"


# Lovable generate-render.ts verbatim render-family rules + negative.
NEGATIVE_PROMPT = (
    "AVOID: melted metal, warped geometry, floating stones, duplicate bail, extra clasp, unwanted chain, "
    "random diamonds, changed reference structure, distorted text, asymmetry, blurry setting, loose stones, "
    "unrealistic plastic metal, fantasy elements, changed subtype, ANY engraved or stamped "
    "text/letters/numbers/logos/brand-marks/watermarks/signatures that the user did not explicitly request "
    "(no 'CraftsmanAI', no 'Craftsman', no 'AI', no tool/brand names, no placeholder names like 'NAME' or "
    "'LOGO', no sample monograms)."
)


def _component_rule(label):
    return (f"STANDALONE COMPONENT: render the {label.lower()} ALONE on a clean white background. Do NOT "
            "attach a pendant, chain, bracelet, or any other jewelry unless the user explicitly asked.")


def _set_rule(detected_subtype, image_count):
    set_multi = ""
    if image_count and image_count > 1:
        set_multi = (f" MULTI-REFERENCE SET INPUT: The user uploaded {image_count} reference images for this set. "
            "Treat them as per-piece references — typically image 1 = EARRING reference, image 2 = PENDANT "
            "reference (if a 3rd image is present, treat it as the RING or extra-piece reference). Reproduce each "
            "piece faithfully from its own reference (geometry, stones, setting, proportions), then unify metal, "
            "finish, and design language across all pieces so they read as one matching set. Do NOT average the "
            "references into a single hybrid object — keep each piece distinct and recognizable from its source image.")
    return ("MATCHING SET — FIXED LAYOUT: render the set as a SINGLE flat-lay composition on a pure white "
        "(#FFFFFF) background, top-down orthographic view, NO shadows, NO reflections, NO surface. Composition is "
        "ALWAYS: two matching earrings/studs side-by-side on the TOP ROW (left and right, evenly spaced, identical "
        "orientation, mirrored if applicable), and ONE matching pendant CENTERED BELOW them on the bottom — pendant "
        "is larger than the earrings and sits centered between/under the two earring positions. All pieces share the "
        "exact same design language, stones, metal, and finish. Render multiple distinct pieces — never merge them "
        "into one object. The pendant-only no-chain rule does NOT apply here; pendant shows its bail but NO chain "
        f"unless the user explicitly asked. If the user-detected subtype \"{detected_subtype or 'Full Matching Set'}\" "
        "implies additional pieces (e.g. ring), keep the earrings-top / pendant-center anchor and place the extra "
        f"piece symmetrically; otherwise default to earrings + pendant only.{set_multi}")


def _custom_object_rule(label):
    return (f"CUSTOM OBJECT: interpret \"{label}\" as a jewelry piece — a manufacturable, wearable interpretation. "
            "Do NOT replicate the literal everyday object; produce a fine-jewelry version of it.")


def per_type_tail(item_type, *, label=None, detected_subtype="", image_count=0, include_negative=True):
    """Lovable per-type behaviour tail to append AFTER build_lovable_create(...): the type's verbatim
    default_output_behavior + the render-family rule (standalone component / matching set / custom object)
    + the verbatim NEGATIVE."""
    canon = resolve_canonical_type(item_type)
    meta = LOVABLE_TAXONOMY[canon]
    label = label or (item_type or "piece")
    parts = [meta["default_output_behavior"]]
    fam = meta["render_family"]
    if fam in ("jewelry_component", "accessory_piece") and meta["default_angle_policy"] == "isolated_product_view":
        parts.append(_component_rule(label))
    elif fam == "matching_set":
        parts.append(_set_rule(detected_subtype, image_count))
    elif fam == "custom_object":
        parts.append(_custom_object_rule(label))
    if include_negative:
        parts.append(NEGATIVE_PROMPT)
    return "\n\n".join(p for p in parts if p)
