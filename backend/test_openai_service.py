import os
import sys
import re
import json
import base64
import requests

from dotenv import load_dotenv

# =========================================================
# PROJECT SETUP
# =========================================================

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

# =========================================================
# UNIVERSAL GPT-IMAGE-2 JEWELRY ENGINE
# EXACT STRUCTURE PRESERVATION VERSION
# =========================================================
#
# GOALS:
#
# - EXACT structure preservation
# - exact typography positioning
# - exact layer relationships
# - no floating text
# - no medallion drift
# - no redesign hallucination
# - realistic manufactured jewelry
# - sketch understanding
# - typography attachment topology
#
# =========================================================

# =========================================================
# MASTER PROMPT
# =========================================================

MASTER_PROMPT = """

Convert the EXACT uploaded design
into REAL manufactured jewelry
WITHOUT altering the original structure.

The uploaded image is the PRIMARY STRUCTURAL BLUEPRINT.

The goal is:
PRECISION MANUFACTURING CONVERSION,
NOT redesign.

The final result must resemble:
- professionally manufactured jewelry
- physically believable jewelry
- handcrafted luxury metalwork
- real jewelry product photography

Generate:
REAL jewelry photography,
NOT CGI artwork.

CRITICAL:
Do NOT redesign the artwork.

Preserve EXACTLY:
- silhouette
- composition
- spacing
- geometry
- proportions
- typography layout
- negative space
- framing placement
- curve positioning
- visual hierarchy
- overlap relationships
- asymmetry
- structure balance

Convert the EXISTING design into:
REAL 3D jewelry engineering.

Do NOT:
- reinterpret
- beautify
- optimize
- symmetrize
- rebalance
- simplify
- radialize
- reorganize
- center-align

Maintain:
- realistic jewelry thickness
- realistic cast depth
- believable support geometry
- realistic metal topology
- realistic polish behavior
- realistic jewelry engineering

Lighting:
- luxury jewelry studio photography
- macro jewelry photography
- realistic reflections
- controlled highlights
- believable shadows

Avoid:
- floating geometry
- fake diamonds
- melted metal
- AI smoothness
- vector appearance
- plastic surfaces
- cartoon rendering
- fantasy geometry
- procedural symmetry
- decal typography

"""

# =========================================================
# SAFE WORD DETECTION
# =========================================================

def has_word(text, word):

    return re.search(
        rf"\b{re.escape(word)}\b",
        text,
        flags=re.IGNORECASE
    ) is not None

# =========================================================
# SANITIZE PROMPT
# =========================================================

def sanitize_prompt(prompt):

    replacements = {
        "pokemon": "monster character",
        "spiderman": "comic superhero",
        "batman": "comic vigilante",
        "disney": "animated character",
        "mario": "game mascot character"
    }

    cleaned = prompt

    for original, replacement in replacements.items():

        cleaned = re.sub(
            original,
            replacement,
            cleaned,
            flags=re.IGNORECASE
        )

    return cleaned

# =========================================================
# USER INTENT PARSER
# =========================================================

def parse_user_intent(user_prompt):

    prompt = user_prompt.lower()

    result = {
        "metal": "gold",
        "style": "clean_luxury",
        "icing": "minimal",
        "jewelry_type": None,
        "finish": "polished",
        "stones": False,
        "stone_cut": "standard",
        "preserve_reference": True
    }

    # =====================================================
    # METAL
    # =====================================================

    if "silver" in prompt:

        result["metal"] = "silver"

    elif "rose gold" in prompt:

        result["metal"] = "rose_gold"

    elif "white gold" in prompt:

        result["metal"] = "white_gold"

    # =====================================================
    # STONES
    # =====================================================

    if any(k in prompt for k in [
        "diamond",
        "diamonds",
        "stones",
        "vvs",
        "iced",
        "pave",
        "moissanite",
        "cz"
    ]):

        result["stones"] = True

    # =====================================================
    # STONE CUT
    # =====================================================

    if "single cut" in prompt:

        result["stone_cut"] = "single_cut"

    # =====================================================
    # CLEAN
    # =====================================================

    if any(k in prompt for k in [
        "clean",
        "subtle",
        "minimal"
    ]):

        result["icing"] = "minimal"

    # =====================================================
    # FLOODED
    # =====================================================

    if any(k in prompt for k in [
        "fully iced",
        "flooded",
        "iced out",
        "bustdown"
    ]):

        result["icing"] = "heavy"

    # =====================================================
    # JEWELRY TYPES
    # =====================================================

    jewelry_types = [
        "pendant",
        "ring",
        "chain",
        "bracelet",
        "watch",
        "grillz",
        "earring"
    ]

    for item in jewelry_types:

        if has_word(prompt, item):

            result["jewelry_type"] = item

    return result

# =========================================================
# GPT VISION ANALYSIS
# =========================================================
#
# REPLACE WITH GPT-4.1 VISION
# =========================================================

def analyze_reference_image(reference_image_path):

    return {

        # =================================================
        # DESIGN TYPE
        # =================================================

        "design_type": "logo",

        # =================================================
        # TYPOGRAPHY
        # =================================================

        "contains_typography": True,

        # =================================================
        # STRUCTURE
        # =================================================

        "primary_elements": [
            "main typography",
            "main structure"
        ],

        "secondary_elements": [
            "support geometry"
        ],

        "tertiary_elements": [
            "framing arcs"
        ],

        # =================================================
        # STYLE
        # =================================================

        "symmetry": "asymmetrical",
        "depth_type": "flat",

        # =================================================
        # SKETCH
        # =================================================

        "is_sketch": False
    }

# =========================================================
# AUTO JEWELRY TYPE
# =========================================================

def auto_detect_jewelry_type(
    user_intent,
    image_analysis
):

    if user_intent["jewelry_type"]:

        return user_intent["jewelry_type"]

    mapping = {
        "logo": "pendant",
        "portrait": "pendant",
        "character": "pendant",
        "religious": "pendant",
        "animal": "pendant",
        "grillz": "grillz"
    }

    return mapping.get(
        image_analysis["design_type"],
        "pendant"
    )

# =========================================================
# HARD STRUCTURE LOCK
# =========================================================

def build_hard_structure_lock():

    return """

HARD STRUCTURE LOCK MODE:

The uploaded reference image is the EXACT design blueprint.

Preserve EXACTLY:
- silhouette
- geometry
- spacing
- proportions
- typography layout
- curve positioning
- artwork alignment
- framing placement
- negative space
- relative scale
- composition balance

Do NOT:
- redesign
- rebalance
- reinterpret
- symmetrize
- beautify
- optimize
- simplify
- reshape
- radialize

Do NOT:
- convert the design into a medallion
- force circular composition
- enlarge framing arcs
- alter typography proportions

The final jewelry must appear as:
THE SAME EXACT DESIGN,
physically manufactured in metal.

The goal is:
manufacturing conversion,
NOT redesign.

"""

# =========================================================
# MATERIAL LOGIC
# =========================================================

def build_material_logic(user_intent):

    metal = user_intent["metal"]

    if metal == "gold":

        return """

Use realistic polished yellow gold.

Maintain:
- realistic gold reflections
- believable cast gold behavior
- luxury jewelry polish realism

"""

    elif metal == "silver":

        return """

Use realistic polished sterling silver.

Maintain:
- realistic silver reflections
- believable silver metal behavior

"""

    elif metal == "rose_gold":

        return """

Use realistic polished rose gold.

Maintain:
- warm luxury reflections
- realistic rose gold appearance

"""

    elif metal == "white_gold":

        return """

Use realistic polished white gold.

Maintain:
- bright luxury reflections
- believable white gold behavior

"""

    return ""

# =========================================================
# STONE LOGIC
# =========================================================

def build_stone_logic(
    user_intent,
    image_analysis
):

    if not user_intent["stones"]:

        return """

Do not add diamonds or gemstones.

Maintain clean polished metal surfaces.

"""

    logic = """

Use realistic luxury diamond setting.

Diamonds must appear:
- handset
- physically mounted
- realistically seated
- structurally believable

Avoid:
- fake diamond textures
- procedural sparkle
- glitter flooding
- unrealistic stone saturation

"""

    # =====================================================
    # CLEAN STONES
    # =====================================================

    if user_intent["icing"] == "minimal":

        logic += """

Use selective stone placement.

ONLY place stones in:
- accents
- trim regions
- intended highlight areas

Preserve visible polished metal surfaces.

Avoid excessive flooding.

"""

    # =====================================================
    # HEAVY ICING
    # =====================================================

    elif user_intent["icing"] == "heavy":

        logic += """

Heavy stone coverage is allowed.

Maintain:
- realistic spacing
- believable engineering
- structural readability

Avoid random flooding.

"""

    # =====================================================
    # SINGLE CUT
    # =====================================================

    if user_intent["stone_cut"] == "single_cut":

        logic += """

Use realistic vintage SINGLE CUT diamonds.

Maintain:
- smaller stones
- visible metal between stones
- restrained reflections
- hand-set appearance

Avoid oversized modern pave.

"""

    return logic

# =========================================================
# TYPOGRAPHY ENGINEERING
# =========================================================

def build_typography_engineering_logic(
    image_analysis
):

    if not image_analysis.get(
        "contains_typography",
        False
    ):

        return ""

    return """

TYPOGRAPHY ENGINEERING RULES:

All typography must be treated as:
FULL PHYSICAL METAL GEOMETRY.

Every letter must be:
- fully extruded
- structurally connected
- physically manufactured
- cast as solid metal
- realistically supported

Typography must NEVER appear:
- floating
- engraved texture
- embossed graphics
- decal-like
- etched onto metal

Each letter must have:
- visible side walls
- realistic thickness
- believable depth
- cast metal topology

Typography may be subtly thickened
ONLY when necessary for realistic
physical jewelry manufacturing.

All typography must share
continuous structural connection
with surrounding geometry.

"""

# =========================================================
# TYPOGRAPHY ATTACHMENT ENGINE
# =========================================================

def build_typography_attachment_logic(
    image_analysis
):

    if not image_analysis.get(
        "contains_typography",
        False
    ):

        return ""

    return """

TYPOGRAPHY ATTACHMENT RULES:

All typography must be physically integrated
into the jewelry structure.

Typography must NEVER appear:
- floating
- unsupported
- pasted onto surfaces
- hanging unnaturally

Every text element must connect realistically
to surrounding geometry.

Use:
- support bridges
- welded geometry
- integrated backing structure
- realistic support points

Preserve the ORIGINAL attachment style
from the reference image.

If text overlaps geometry,
maintain the SAME overlap relationship.

If text intersects curves,
preserve the SAME structural interaction.

"""

# =========================================================
# MICRO TYPOGRAPHY ENGINE
# =========================================================

def build_micro_typography_logic():

    return """

MICRO TYPOGRAPHY RULES:

Small typography must remain:
- fully extruded
- physically raised
- visibly dimensional
- structurally supported

Small typography must NEVER become:
- engraving
- texture
- embossing
- stamped graphics

Even very small text must have:
- visible side walls
- metal thickness
- believable extrusion

"""

# =========================================================
# RELATIVE SCALE LOCK
# =========================================================

def build_relative_scale_logic():

    return """

RELATIVE SCALE ENFORCEMENT:

Maintain the EXACT relative scale relationships
between all design elements.

Do NOT:
- enlarge support geometry
- reduce typography dominance
- alter curve proportions
- increase framing mass

Typography must remain
the dominant visual structure.

"""

# =========================================================
# LAYER RELATIONSHIP LOCK
# =========================================================

def build_layer_relationship_logic():

    return """

LAYER RELATIONSHIP PRESERVATION:

Preserve the exact front/back layering
relationships from the reference image.

Maintain:
- overlap hierarchy
- crossing geometry
- foreground typography
- background support geometry

Do NOT:
- flatten the composition
- reorder visual layers
- simplify overlap depth

"""

# =========================================================
# NEGATIVE SPACE LOGIC
# =========================================================

def build_negative_space_logic():

    return """

Preserve intentional negative space.

Do NOT:
- flood all gaps with diamonds
- fill empty regions
- overdecorate clean surfaces

Maintain luxury restraint.

"""

# =========================================================
# SKETCH RECONSTRUCTION LOGIC
# =========================================================

def build_sketch_logic(image_analysis):

    if not image_analysis.get(
        "is_sketch",
        False
    ):

        return ""

    return """

SKETCH RECONSTRUCTION MODE:

Interpret the sketch as:
- manufacturing blueprint
- jewelry structure guide

Preserve EXACTLY:
- line flow
- text placement
- proportions
- layout
- attachment relationships

Convert the sketch into:
REAL manufactured jewelry
WITHOUT redesigning the artwork.

"""

# =========================================================
# STRUCTURE LOGIC
# =========================================================

def build_structure_logic(image_analysis):

    design_type = image_analysis["design_type"]

    # =====================================================
    # LOGO
    # =====================================================

    if design_type == "logo":

        return """

LOGO STRUCTURE RULES:

The typography structure
must remain the dominant visual mass.

Supporting arcs and framing geometry
must remain secondary.

Do NOT:
- radialize the design
- convert into medallion layout
- rebalance composition
- enlarge support geometry

Preserve the exact asymmetry
from the original artwork.

"""

    return ""

# =========================================================
# JEWELRY TYPE LOGIC
# =========================================================

def build_jewelry_type_logic(jewelry_type):

    if jewelry_type == "pendant":

        return """

This object is a PENDANT.

It must remain a pendant.

Pendant must include:
- realistic bail
- believable hanging structure
- realistic orientation
- wearable proportions

Avoid generic medallion layouts.

"""

    elif jewelry_type == "ring":

        return """

This object is a RING.

Maintain:
- realistic ring proportions
- believable finger opening
- wearable structure

"""

    elif jewelry_type == "chain":

        return """

This object is a CHAIN.

Maintain:
- realistic links
- believable mechanics
- wearable structure

"""

    elif jewelry_type == "grillz":

        return """

This object is GRILLZ jewelry.

Preserve:
- tooth topology
- realistic dental structure
- believable fitment

Avoid fantasy geometry.

"""

    return ""

# =========================================================
# FINAL PROMPT BUILDER
# =========================================================

def build_final_prompt(
    user_prompt,
    reference_image_path
):

    # =====================================================
    # SANITIZE
    # =====================================================

    user_prompt = sanitize_prompt(
        user_prompt
    )

    # =====================================================
    # USER INTENT
    # =====================================================

    user_intent = parse_user_intent(
        user_prompt
    )

    # =====================================================
    # IMAGE ANALYSIS
    # =====================================================

    image_analysis = analyze_reference_image(
        reference_image_path
    )

    # =====================================================
    # AUTO TYPE
    # =====================================================

    jewelry_type = auto_detect_jewelry_type(
        user_intent,
        image_analysis
    )

    # =====================================================
    # BUILD LOGIC MODULES
    # =====================================================

    hard_structure_logic = (
        build_hard_structure_lock()
    )

    material_logic = (
        build_material_logic(
            user_intent
        )
    )

    stone_logic = (
        build_stone_logic(
            user_intent,
            image_analysis
        )
    )

    typography_engineering_logic = (
        build_typography_engineering_logic(
            image_analysis
        )
    )

    typography_attachment_logic = (
        build_typography_attachment_logic(
            image_analysis
        )
    )

    micro_typography_logic = (
        build_micro_typography_logic()
    )

    relative_scale_logic = (
        build_relative_scale_logic()
    )

    layer_relationship_logic = (
        build_layer_relationship_logic()
    )

    negative_space_logic = (
        build_negative_space_logic()
    )

    sketch_logic = (
        build_sketch_logic(
            image_analysis
        )
    )

    structure_logic = (
        build_structure_logic(
            image_analysis
        )
    )

    jewelry_type_logic = (
        build_jewelry_type_logic(
            jewelry_type
        )
    )

    # =====================================================
    # FINAL PROMPT
    # =====================================================

    final_prompt = f"""

{MASTER_PROMPT}

USER REQUEST:
{user_prompt}

DETECTED DESIGN TYPE:
{image_analysis['design_type']}

DETECTED JEWELRY TYPE:
{jewelry_type}

HARD STRUCTURE LOCK:
{hard_structure_logic}

MATERIAL LOGIC:
{material_logic}

STONE LOGIC:
{stone_logic}

TYPOGRAPHY ENGINEERING:
{typography_engineering_logic}

TYPOGRAPHY ATTACHMENT:
{typography_attachment_logic}

MICRO TYPOGRAPHY:
{micro_typography_logic}

RELATIVE SCALE LOGIC:
{relative_scale_logic}

LAYER RELATIONSHIP LOGIC:
{layer_relationship_logic}

NEGATIVE SPACE LOGIC:
{negative_space_logic}

SKETCH LOGIC:
{sketch_logic}

STRUCTURE LOGIC:
{structure_logic}

JEWELRY TYPE LOGIC:
{jewelry_type_logic}

FINAL INSTRUCTIONS:

The uploaded image defines the TRUE structure.

Preserve EXACTLY:
- typography placement
- geometry
- silhouette
- spacing
- overlap hierarchy
- composition balance
- support relationships

Only transform:
- materials
- jewelry realism
- manufacturing topology
- physical depth

Generate:
REAL manufactured jewelry photography,
NOT redesign artwork.

"""

    return final_prompt

# =========================================================
# SAVE RESULT
# =========================================================

def save_generation_result(
    result,
    output_filename
):

    b64_json = getattr(
        result,
        "b64_json",
        None
    ) or (
        result.get("b64_json")
        if isinstance(result, dict)
        else None
    )

    if b64_json:

        img_data = base64.b64decode(
            b64_json
        )

        with open(
            output_filename,
            "wb"
        ) as handler:

            handler.write(img_data)

        print(f"[SUCCESS] Saved: {output_filename}")

        return

    image_url = getattr(
        result,
        "url",
        None
    ) or (
        result.get("url")
        if isinstance(result, dict)
        else None
    )

    if image_url:

        img_data = requests.get(
            image_url
        ).content

        with open(
            output_filename,
            "wb"
        ) as handler:

            handler.write(img_data)

        print(f"[SUCCESS] Saved: {output_filename}")

# =========================================================
# MAIN
# =========================================================

def main():

    print("==============================================")
    print(" UNIVERSAL GPT-IMAGE-2 JEWELRY ENGINE")
    print("==============================================")

    api_key = os.getenv(
        "OPENAI_API_KEY"
    )

    if not api_key:

        print("[ERROR] OPENAI_API_KEY missing")
        sys.exit(1)

    # =====================================================
    # IMPORT SERVICE
    # =====================================================

    try:

        from app.services.openai_service import openai_service

    except Exception as e:

        print(f"[ERROR] {e}")
        sys.exit(1)

    # =====================================================
    # USER PROMPT
    # =====================================================

    user_prompt = """

10K Yellow Gold
Single Cut Clean Stones
Width 2.5"
Length 1.1"
plus bail
type pendant

"""

    # =====================================================
    # REFERENCE IMAGE
    # =====================================================

    reference_image_path = "uploads/refrence22.png"

    if not os.path.exists(reference_image_path):

        print("[ERROR] Reference image not found.")
        sys.exit(1)

    # =====================================================
    # BUILD FINAL PROMPT
    # =====================================================

    final_prompt = build_final_prompt(
        user_prompt=user_prompt,
        reference_image_path=reference_image_path
    )

    print("\n==============================================")
    print(" FINAL PROMPT")
    print("==============================================\n")

    print(final_prompt)

    # =====================================================
    # LIVE GENERATION
    # =====================================================

    if "--live" in sys.argv:

        try:

            result = openai_service.generate_base_image(
                image_source=reference_image_path,
                user_prompt=final_prompt
            )

            save_generation_result(
                result,
                "uploads/generated_output.png"
            )

        except Exception as e:

            print(f"[ERROR] {e}")

    else:

        print("\nPreview mode.")
        print("Run with:")
        print("python your_file.py --live")

# =========================================================
# ENTRY
# =====================================================

if __name__ == "__main__":
    main()