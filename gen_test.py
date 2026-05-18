import os
import uuid
import base64
import logging
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor

import requests
from PIL import Image
from dotenv import load_dotenv
from openai import OpenAI


# ---------------------------------------------------
# ENV
# ---------------------------------------------------

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------
# CONFIG
# ---------------------------------------------------

OUTPUT_DIR = "testimages/final_4_outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

FINAL_SIZE = (1024, 1024)

BASE_VARIATIONS = 1
ANGLE_VARIATIONS = 1
LIFESTYLE_VARIATIONS = 1


# ---------------------------------------------------
# IMAGE UTILS
# ---------------------------------------------------

def save_image(data_item, prefix, folder):
    """
    Save image to Supabase storage only.
    Returns the Supabase public URL.
    """

    filename = f"{prefix}_{uuid.uuid4().hex}.png"

    # Get image bytes from data_item
    if getattr(data_item, "b64_json", None):
        img_bytes = base64.b64decode(data_item.b64_json)
    elif getattr(data_item, "url", None):
        resp = requests.get(data_item.url)
        img_bytes = resp.content
    else:
        raise ValueError("No valid image data found in data_item")

    # Save to Supabase only
    try:
        from app.services.supabase.storage_service import upload_image_to_supabase
        
        # Create bucket path for Supabase
        bucket_path = f"renders/{folder}/{filename}"
        
        # Upload to Supabase and get public URL
        supabase_url = upload_image_to_supabase(img_bytes, bucket_path)
        
        logger.info(f"Image saved to Supabase: {supabase_url}")
        
        # Return Supabase URL
        return supabase_url
        
    except Exception as e:
        logger.error(f"Failed to upload to Supabase: {e}")
        raise Exception(f"Supabase upload failed: {e}")

    # OLD LOCAL + SUPABASE CODE (COMMENTED OUT - KEPT FOR REFERENCE)
    # folder_path = os.path.join(OUTPUT_DIR, folder)
    # os.makedirs(folder_path, exist_ok=True)
    # local_path = os.path.join(folder_path, filename)
    # 
    # if getattr(data_item, "b64_json", None):
    #     img_bytes = base64.b64decode(data_item.b64_json)
    #     img = Image.open(BytesIO(img_bytes))
    #     img.save(local_path)
    # elif getattr(data_item, "url", None):
    #     resp = requests.get(data_item.url)
    #     img_bytes = resp.content
    #     img = Image.open(BytesIO(img_bytes))
    #     img.save(local_path)
    # else:
    #     raise ValueError("No valid image data found in data_item")
    # 
    # # Save to Supabase in addition to local storage
    # try:
    #     from app.services.supabase.storage_service import upload_image_to_supabase
    #     
    #     # Create bucket path for Supabase
    #     bucket_path = f"renders/{folder}/{filename}"
    #     
    #     # Upload to Supabase and get public URL
    #     supabase_url = upload_image_to_supabase(img_bytes, bucket_path)
    #     
    #     logger.info(f"Image saved locally: {local_path}")
    #     logger.info(f"Image saved to Supabase: {supabase_url}")
    #     
    #     # Return both paths for compatibility
    #     return {
    #         "local_path": local_path,
    #         "supabase_url": supabase_url
    #     }
    #     
    # except Exception as e:
    #     logger.warning(f"Failed to upload to Supabase: {e}")
    #     logger.info(f"Image saved locally only: {local_path}")
    #     
    #     # Return local path only if Supabase upload fails
    #     return {
    #         "local_path": local_path,
    #         "supabase_url": None
    #     }


def load_image_buffer_from_source(source: str):

    if source.startswith("http"):
        resp = requests.get(source)
        img = Image.open(BytesIO(resp.content))
    else:
        img = Image.open(source)

    img = img.convert("RGBA")
    img = img.resize(FINAL_SIZE)

    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return ("image.png", buf, "image/png")


# ---------------------------------------------------
# PROMPTS
# ---------------------------------------------------

def build_master_prompt(user_prompt):

    return f"""
ROLE

You are an advanced jewelry reconstruction and controlled-edit engine
used by luxury jewelry design studios.

You specialize in recreating jewelry designs from reference images
while allowing precise user-requested modifications without redesigning
the entire piece.


INPUT

You receive:

1. A reference image
2. A user request

The reference image may be:

• jewelry photograph
• CAD render
• sketch / drawing
• engraving / pattern
• non-jewelry object (flower, animal, symbol, etc.)

Your task is to reconstruct the design as a high-end jewelry
studio photograph while respecting the user request.


------------------------------------------------
PROCESSING PIPELINE
------------------------------------------------

Step 1 — Analyze Reference Image

Extract the following design structure:

• jewelry type (ring / pendant / bracelet / necklace / earring / brooch / etc.)
• overall geometry
• structural layout
• stone placement
• prong structure
• engravings
• patterns
• symmetry
• proportions
• metal surfaces


Step 2 — Identify Locked Design Features

All structural elements must initially be considered LOCKED.

Locked elements include:

• stone count
• stone shape
• stone size ratios
• stone placement
• stone spacing
• prong count
• prong placement
• band width
• band curvature
• engraving patterns
• decorative motifs
• symmetry
• geometry proportions
• surface textures


Step 3 — Parse User Request

Analyze the user instruction and determine:

• what must change
• which structural elements are affected


Example:

User request:
"Add one more Roman numeral band"

Required unlocks:

• band width
• band layering
• band spacing
• band structure


Step 4 — Controlled Unlock System

Unlock ONLY the elements required to satisfy the user request.

Do NOT unlock unrelated design features.

Example:

Add stone row → unlock:
• stone count
• band width
• prong count

But keep locked:

• existing stone pattern
• band curvature
• engravings


Step 5 — Dependency Unlocking

If a requested change forces structural adjustments,
automatically unlock dependent elements.

Examples:

Adding stones may require adjusting:

• band width
• prong count
• spacing

Adding a band layer may require adjusting:

• ring thickness
• band spacing

However:

Existing design language must remain preserved.


------------------------------------------------
REFERENCE IMAGE INTERPRETATION
------------------------------------------------

The reference image may not always be jewelry.

Interpret shapes intelligently and convert them into jewelry design.

Rules:

If input is a flower (example: rose)

• recreate the flower as jewelry
• petals → gemstone clusters
• center → gemstone core
• leaves → green gemstones
• metal framework follows flower geometry


If input is an animal (example: leopard)

• recreate the animal silhouette as jewelry
• body structure → metal framework
• surface → diamond / gemstone pavé
• pattern spots → darker stones


If input is a sketch

• preserve the exact geometry
• convert lines into metal structures
• convert indicated stones into gemstones


If input is CAD

• maintain exact structure
• convert to photorealistic materials


If input is jewelry photo

• recreate the same design with higher
  studio-quality rendering


------------------------------------------------
DESIGN PRESERVATION RULES
------------------------------------------------

Unless unlocked by the user request,
the following must remain identical:

• geometry
• stone layout
• prong configuration
• proportions
• structural symmetry
• design patterns
• engravings


Never:

• simplify geometry
• remove details
• redesign patterns
• merge stones
• remove prongs


------------------------------------------------
JEWELRY MATERIAL REALISM
------------------------------------------------

Render materials physically correctly.

Metals:

• gold
• white gold
• platinum
• rose gold

Gemstones:

• diamond
• ruby
• emerald
• sapphire
• custom stones if required

Ensure:

• gemstone refraction
• realistic brilliance
• accurate metal reflections
• sharp prong edges


------------------------------------------------
PHOTOGRAPHY STYLE
------------------------------------------------

Render as luxury commercial jewelry photography.

Lighting:

• professional studio lighting
• soft diffused key light
• gemstone sparkle highlights
• controlled reflections

Camera:

• macro lens
• shallow depth of field
• high sharpness on jewelry

Background:

• luxury white or soft gradient
• subtle product shadow


------------------------------------------------
QUALITY TARGET
------------------------------------------------

Output quality should match high-end product photography
from luxury jewelry houses such as:

Cartier
Tiffany
Bulgari
Van Cleef

------------------------------------------------
USER REQUIREMENTs
------------------------------------------------

{user_prompt}

------------------------------------------------
OUTPUT
------------------------------------------------

Generate ONE high-end jewelry product image.

The final design must:

• preserve locked design features
• apply user-requested changes
• maintain structural integrity
• look like a real luxury jewelry photograph
"""


def build_angle_prompt(angle):

    return f"""
ROLE

You are an advanced jewelry reconstruction and controlled-edit engine
used by luxury jewelry design studios.

You specialize in recreating jewelry designs from reference images
while allowing precise user-requested modifications without redesigning
the entire piece.

INPUT

You receive:

1. A reference image
2. A user request

The reference image may be:

• jewelry photograph
• CAD render
• sketch / drawing
• engraving / pattern
• non-jewelry object (flower, animal, symbol, etc.)

Your task is to reconstruct the design as a high-end jewelry
studio photograph while respecting the user request.

---

## CORE PRINCIPLE

You are NOT editing pixels.

You are reconstructing the object as a real-world,
three-dimensional jewelry piece and re-rendering it.

The output must feel like a physically real object,
not a modified image.

---

## PROCESSING PIPELINE

Step 1 — Analyze Reference Image

Extract the following design structure:

• jewelry type (ring / pendant / bracelet / necklace / earring / brooch / etc.)
• overall geometry
• structural layout
• thickness and depth
• stone placement
• prong structure
• engravings
• patterns
• symmetry
• proportions
• metal surfaces

Step 2 — Identify Locked Design Features

All structural elements must initially be considered LOCKED.

Locked elements include:

• stone count
• stone shape
• stone size ratios
• stone placement
• stone spacing
• prong count
• prong placement
• band width
• band thickness
• band curvature
• engraving patterns
• decorative motifs
• symmetry
• geometry proportions
• surface textures

Step 3 — Parse User Request

Analyze the user instruction and determine:

• what must change
• which structural elements are affected

Example:

User request:
"Add one more Roman numeral band"

Required unlocks:

• band width
• band layering
• band spacing
• band structure

Step 4 — Controlled Unlock System

Unlock ONLY the elements required to satisfy the user request.

Do NOT unlock unrelated design features.

Example:

Add stone row → unlock:
• stone count
• band width
• prong count

But keep locked:

• existing stone pattern
• band curvature
• engravings

Step 5 — Dependency Unlocking

If a requested change forces structural adjustments,
automatically unlock dependent elements.

Examples:

Adding stones may require adjusting:

• band width
• prong count
• spacing

Adding a band layer may require adjusting:

• ring thickness
• band spacing

However:

Existing design language must remain preserved.

---

## 3D RECONSTRUCTION REQUIREMENT

Reconstruct the jewelry as a true 3D object.

Ensure:

• visible thickness and depth
• realistic side walls
• accurate structural layering
• proper physical proportions

The object must look manufacturable and physically plausible,
not flat or symbolic.

---

## REFERENCE IMAGE INTERPRETATION

The reference image may not always be jewelry.

Interpret shapes intelligently and convert them into jewelry design.

Rules:

If input is a flower (example: rose)

• recreate the flower as jewelry
• petals → gemstone clusters
• center → gemstone core
• leaves → green gemstones
• metal framework follows flower geometry

If input is an animal (example: leopard)

• recreate the animal silhouette as jewelry
• body structure → metal framework
• surface → diamond / gemstone pavé
• pattern spots → darker stones

If input is a sketch

• preserve the exact geometry
• convert lines into metal structures
• convert indicated stones into gemstones

If input is CAD

• maintain exact structure
• convert to photorealistic materials

If input is jewelry photo

• recreate the same design with higher
studio-quality rendering

---

## DESIGN PRESERVATION RULES

Unless explicitly unlocked by the user request,
the following must remain identical:

• geometry (structural relationships)
• stone layout
• prong configuration
• proportions
• structural symmetry
• design patterns
• engravings

IMPORTANT:

Geometry must remain physically consistent,
but natural perspective and depth representation are allowed.

Never:

• simplify geometry
• remove details
• redesign patterns
• merge stones
• remove prongs

---

## JEWELRY MATERIAL REALISM

Render materials physically correctly.

Metals:

• gold
• white gold
• platinum
• rose gold

Gemstones:

• diamond
• ruby
• emerald
• sapphire
• custom stones if required

Ensure:

• gemstone refraction
• realistic brilliance
• accurate metal reflections
• sharp prong edges
• visible stone facets

---

## PHOTOGRAPHY STYLE

Render as luxury commercial jewelry photography.

Lighting:

• professional studio lighting
• soft diffused key light
• gemstone sparkle highlights
• controlled reflections

Camera:

• macro lens
• shallow depth of field
• high sharpness on jewelry

Background:

• luxury white or soft gradient
• subtle product shadow

---

## QUALITY TARGET

Output quality should match high-end product photography
from luxury jewelry houses such as:

Cartier
Tiffany
Bulgari
Van Cleef

---

## ERROR PREVENTION

Incorrect outputs include:

• flat or 2D-looking jewelry
• simplified geometry
• missing prongs
• altered stone layout without instruction
• distorted proportions
• unrealistic materials

These must be avoided.

---

## USER REQUIREMENTS

{angle}

---

## OUTPUT

Generate ONE high-end jewelry product image.

The final design must:

• preserve locked design features
• apply user-requested changes
• maintain structural integrity
• appear as a real, manufacturable jewelry piece
• look like a luxury studio product photograph

"""


def build_lifestyle_prompt():

    return """
ROLE

You are a luxury jewelry photography engine.

You are given a jewelry product image that represents the
final approved jewelry design.

Your task is to place the exact same jewelry naturally on a person
and render it as a high-end lifestyle fashion photograph.

This is NOT a redesign task.


------------------------------------------------
SOURCE OF TRUTH
------------------------------------------------

The provided jewelry image is the authoritative design.

The jewelry structure must remain identical.


------------------------------------------------
STRUCTURE LOCK
------------------------------------------------

All design elements are permanently locked.

Preserve exactly:

Geometry

• jewelry silhouette
• proportions
• symmetry
• curvature

Stone Structure

• stone count
• stone shapes
• stone size ratios
• stone spacing
• stone alignment
• stone placement pattern

Setting Details

• prong count
• prong positions
• prong style
• bezel edges
• pavé layout
• channel structures

Metal Structure

• band width
• band thickness
• pendant frame
• connectors
• hooks
• joints
• engravings
• decorative motifs


------------------------------------------------
STRICT PROHIBITIONS
------------------------------------------------

Never:

• add stones
• remove stones
• merge stones
• simplify prongs
• smooth pavé
• change band thickness
• modify engravings
• redesign the jewelry
• change stone layout


The jewelry must remain identical to the input image.


------------------------------------------------
ALLOWED OPERATIONS
------------------------------------------------

Only the following changes are allowed:

• placing the jewelry on a person
• adjusting orientation to match body position
• natural skin interaction
• lighting changes
• background and environment


------------------------------------------------
PLACEMENT RULES
------------------------------------------------

Place the jewelry correctly depending on type.

Ring  
→ worn naturally on a finger

Necklace / Pendant  
→ worn on the neck

Earrings  
→ worn on the ear

Bracelet  
→ worn on the wrist

Brooch  
→ pinned on clothing


The jewelry must appear physically attached and naturally positioned.


------------------------------------------------
REALISM REQUIREMENTS
------------------------------------------------

Ensure realistic interaction with the human subject.

• correct scale relative to body
• natural skin contact
• natural shadows
• realistic reflections on metal
• gemstone sparkle preserved
• jewelry remains sharply visible


------------------------------------------------
PHOTOGRAPHY STYLE
------------------------------------------------

Luxury fashion lifestyle photography.

Lighting

• soft natural lighting
• fashion editorial lighting
• realistic highlights on gemstones

Camera

• shallow depth of field
• macro focus on jewelry
• subject softly blurred

Environment

• elegant fashion setting
• neutral or luxury background
• clean composition


------------------------------------------------
QUALITY TARGET
------------------------------------------------

The image should look like a professional jewelry
fashion campaign photograph from brands such as:

Cartier
Tiffany
Bulgari
Van Cleef


------------------------------------------------
OUTPUT
------------------------------------------------

Generate ONE lifestyle image.

The jewelry must remain identical to the input image
while being worn naturally by a person.
"""


# ---------------------------------------------------
# GENERATORS
# ---------------------------------------------------

def generate_base(image_source, user_prompt):

    logger.info("Generating base design")

    image_file = load_image_buffer_from_source(image_source)

    prompt = build_master_prompt(user_prompt)

    results = []

    for i in range(BASE_VARIATIONS):

        result = client.images.edit(
            model="gpt-image-1.5",
            image=image_file,
            prompt=prompt,
            size="1024x1024",
            n=1
        )

        supabase_url = save_image(result.data[0], f"base_{i}", "base")
        results.append(supabase_url)
        logger.info(f"Base image saved to Supabase: {supabase_url}")

    return results


def generate_angles(base_image):

    logger.info("Generating angles")

    # Handle case where base_image might be a dict or string
    if isinstance(base_image, dict):
        base_path = base_image.get('local_path') or base_image.get('supabase_url')
    else:
        base_path = base_image

    image_file = load_image_buffer_from_source(base_path)

    angles = [
    "rotate 90 degrees to the right, full side profile view, camera at same height",
    "top-down view, camera positioned directly above at 90 degrees looking down"
]

    results = []

    for angle in angles:

        prompt = build_angle_prompt(angle)

        for i in range(ANGLE_VARIATIONS):

            result = client.images.edit(
                model="gpt-image-1.5",
                image=image_file,
                prompt=prompt,
                size="1024x1024",
                n=1
            )

            supabase_url = save_image(
                result.data[0],
                f"{angle.replace(' ','_')}_{i}",
                "angles"
            )
            results.append(supabase_url)
            logger.info(f"{angle} saved to Supabase: {supabase_url}")

    return results


def generate_lifestyle(base_image):

    logger.info("Generating lifestyle image")

    # Handle case where base_image might be a dict or string
    if isinstance(base_image, dict):
        base_path = base_image.get('local_path') or base_image.get('supabase_url')
    else:
        base_path = base_image

    image_file = load_image_buffer_from_source(base_path)

    prompt = build_lifestyle_prompt()

    results = []

    for i in range(LIFESTYLE_VARIATIONS):

        result = client.images.edit(
            model="gpt-image-1.5",
            image=image_file,
            prompt=prompt,
            size="1024x1024",
            n=1
        )

        supabase_url = save_image(
            result.data[0],
            f"lifestyle_{i}",
            "lifestyle"
        )
        results.append(supabase_url)
        logger.info(f"Lifestyle image saved to Supabase: {supabase_url}")

    return results


# ---------------------------------------------------
# MAIN FUNCTION (REUSABLE)
# ---------------------------------------------------

def generate_multi_angle_from_image(
    image_sources: list[str],
    user_prompt: str = None,
    size: str = "1024x1024"
) -> list[str]:

    logger.info("Starting generation pipeline")
    logger.info(f"user prompt: {user_prompt}")
    logger.info(f"Number of reference images: {len(image_sources)}")
    
    # Use the first image as primary reference, others as additional context
    primary_image = image_sources[0]
    additional_images = image_sources[1:] if len(image_sources) > 1 else []
    
    if additional_images:
        logger.info(f"Primary reference: {primary_image}")
        logger.info(f"Additional references: {additional_images}")
    else:
        logger.info(f"Single reference: {primary_image}")

    saved_paths = []

    # 1️⃣ Generate base images first (must be sequential)
    logger.info("Generating base images...")
    bases = generate_base(primary_image, user_prompt)
    saved_paths.extend(bases)
    
    if not bases:
        logger.warning("No base images generated, skipping angles and lifestyle")
        return saved_paths

    base_image = bases[0]
    logger.info(f"Base image generated: {base_image}")

    # 2️⃣ Run angles and lifestyle generation in parallel
    logger.info("Starting parallel generation of angles and lifestyle...")
    with ThreadPoolExecutor(max_workers=2) as executor:
        # Submit both tasks to run in parallel
        logger.info("Submitting angles generation task...")
        angles_future = executor.submit(generate_angles, base_image)
        
        logger.info("Submitting lifestyle generation task...")
        lifestyle_future = executor.submit(generate_lifestyle, base_image)
        
        # Wait for both tasks to complete and get results
        logger.info("Waiting for parallel tasks to complete...")
        angles_result = angles_future.result()
        lifestyle_result = lifestyle_future.result()
        
        logger.info(f"Angles generation completed: {len(angles_result)} images")
        logger.info(f"Lifestyle generation completed: {len(lifestyle_result)} images")

    # 3️⃣ Add all results to saved paths
    saved_paths.extend(angles_result)
    saved_paths.extend(lifestyle_result)
    
    logger.info(f"Total images generated: {len(saved_paths)}")
    logger.info("Generation pipeline completed successfully")

    return saved_paths


# import os
# import uuid
# import base64
# import logging
# from io import BytesIO

# import requests
# from PIL import Image
# from dotenv import load_dotenv
# from openai import OpenAI


# # ---------------------------------------------------
# # ENV
# # ---------------------------------------------------

# load_dotenv()
# client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)


# # ---------------------------------------------------
# # CONFIG
# # ---------------------------------------------------

# INPUT_IMAGE = "ring.png"

# OUTPUT_DIR = "testimages/final_4_outputs"
# os.makedirs(OUTPUT_DIR, exist_ok=True)

# FINAL_SIZE = (1024, 1024)

# # number of variants
# BASE_VARIATIONS = 1
# ANGLE_VARIATIONS = 2
# LIFESTYLE_VARIATIONS = 1


# USER_PROMPT = """
# TYPE: Ring
# SUBTYPE: Band

# USER REQUESR:
# double stack the roman number band and chnage roman numbers to alphabet
# """


# # ---------------------------------------------------
# # IMAGE UTILS
# # ---------------------------------------------------

# def save_image(data_item, prefix, folder):

#     folder_path = os.path.join(OUTPUT_DIR, folder)
#     os.makedirs(folder_path, exist_ok=True)

#     filename = f"{prefix}_{uuid.uuid4().hex}.png"
#     path = os.path.join(folder_path, filename)

#     if getattr(data_item, "b64_json", None):

#         img_bytes = base64.b64decode(data_item.b64_json)
#         img = Image.open(BytesIO(img_bytes))
#         img.save(path)

#     elif getattr(data_item, "url", None):

#         resp = requests.get(data_item.url)
#         img = Image.open(BytesIO(resp.content))
#         img.save(path)

#     return path


# def load_image_buffer(path):

#     img = Image.open(path).convert("RGBA")
#     img = img.resize(FINAL_SIZE)

#     buf = BytesIO()
#     img.save(buf, format="PNG")
#     buf.seek(0)

#     return ("image.png", buf, "image/png")


# # ---------------------------------------------------
# # PROMPTS
# # ---------------------------------------------------

# def build_master_prompt(user_prompt):

#     return f"""
# ROLE

# You are an advanced jewelry reconstruction and controlled-edit engine
# used by luxury jewelry design studios.

# You specialize in recreating jewelry designs from reference images
# while allowing precise user-requested modifications without redesigning
# the entire piece.


# INPUT

# You receive:

# 1. A reference image
# 2. A user request

# The reference image may be:

# • jewelry photograph
# • CAD render
# • sketch / drawing
# • engraving / pattern
# • non-jewelry object (flower, animal, symbol, etc.)

# Your task is to reconstruct the design as a high-end jewelry
# studio photograph while respecting the user request.


# ------------------------------------------------
# PROCESSING PIPELINE
# ------------------------------------------------

# Step 1 — Analyze Reference Image

# Extract the following design structure:

# • jewelry type (ring / pendant / bracelet / necklace / earring / brooch / etc.)
# • overall geometry
# • structural layout
# • stone placement
# • prong structure
# • engravings
# • patterns
# • symmetry
# • proportions
# • metal surfaces


# Step 2 — Identify Locked Design Features

# All structural elements must initially be considered LOCKED.

# Locked elements include:

# • stone count
# • stone shape
# • stone size ratios
# • stone placement
# • stone spacing
# • prong count
# • prong placement
# • band width
# • band curvature
# • engraving patterns
# • decorative motifs
# • symmetry
# • geometry proportions
# • surface textures


# Step 3 — Parse User Request

# Analyze the user instruction and determine:

# • what must change
# • which structural elements are affected


# Example:

# User request:
# "Add one more Roman numeral band"

# Required unlocks:

# • band width
# • band layering
# • band spacing
# • band structure


# Step 4 — Controlled Unlock System

# Unlock ONLY the elements required to satisfy the user request.

# Do NOT unlock unrelated design features.

# Example:

# Add stone row → unlock:
# • stone count
# • band width
# • prong count

# But keep locked:

# • existing stone pattern
# • band curvature
# • engravings


# Step 5 — Dependency Unlocking

# If a requested change forces structural adjustments,
# automatically unlock dependent elements.

# Examples:

# Adding stones may require adjusting:

# • band width
# • prong count
# • spacing

# Adding a band layer may require adjusting:

# • ring thickness
# • band spacing

# However:

# Existing design language must remain preserved.


# ------------------------------------------------
# REFERENCE IMAGE INTERPRETATION
# ------------------------------------------------

# The reference image may not always be jewelry.

# Interpret shapes intelligently and convert them into jewelry design.

# Rules:

# If input is a flower (example: rose)

# • recreate the flower as jewelry
# • petals → gemstone clusters
# • center → gemstone core
# • leaves → green gemstones
# • metal framework follows flower geometry


# If input is an animal (example: leopard)

# • recreate the animal silhouette as jewelry
# • body structure → metal framework
# • surface → diamond / gemstone pavé
# • pattern spots → darker stones


# If input is a sketch

# • preserve the exact geometry
# • convert lines into metal structures
# • convert indicated stones into gemstones


# If input is CAD

# • maintain exact structure
# • convert to photorealistic materials


# If input is jewelry photo

# • recreate the same design with higher
#   studio-quality rendering


# ------------------------------------------------
# DESIGN PRESERVATION RULES
# ------------------------------------------------

# Unless unlocked by the user request,
# the following must remain identical:

# • geometry
# • stone layout
# • prong configuration
# • proportions
# • structural symmetry
# • design patterns
# • engravings


# Never:

# • simplify geometry
# • remove details
# • redesign patterns
# • merge stones
# • remove prongs


# ------------------------------------------------
# JEWELRY MATERIAL REALISM
# ------------------------------------------------

# Render materials physically correctly.

# Metals:

# • gold
# • white gold
# • platinum
# • rose gold

# Gemstones:

# • diamond
# • ruby
# • emerald
# • sapphire
# • custom stones if required

# Ensure:

# • gemstone refraction
# • realistic brilliance
# • accurate metal reflections
# • sharp prong edges


# ------------------------------------------------
# PHOTOGRAPHY STYLE
# ------------------------------------------------

# Render as luxury commercial jewelry photography.

# Lighting:

# • professional studio lighting
# • soft diffused key light
# • gemstone sparkle highlights
# • controlled reflections

# Camera:

# • macro lens
# • shallow depth of field
# • high sharpness on jewelry

# Background:

# • luxury white or soft gradient
# • subtle product shadow


# ------------------------------------------------
# QUALITY TARGET
# ------------------------------------------------

# Output quality should match high-end product photography
# from luxury jewelry houses such as:

# Cartier
# Tiffany
# Bulgari
# Van Cleef

# ------------------------------------------------
# USER REQUIREMENTs
# ------------------------------------------------

# {user_prompt}

# ------------------------------------------------
# OUTPUT
# ------------------------------------------------

# Generate ONE high-end jewelry product image.

# The final design must:

# • preserve locked design features
# • apply user-requested changes
# • maintain structural integrity
# • look like a real luxury jewelry photograph
# """

# def build_angle_prompt(angle):

#     return f"""
# ROLE

# You are a precision jewelry reconstruction engine used by luxury
# product photography studios.

# You are given a jewelry image that already represents the
# final approved design.

# Your task is NOT to redesign the jewelry.

# Your task is to reconstruct the SAME jewelry design and render it as a
# high-end studio product photograph.

# ------------------------------------------------
# Angle
# ------------------------------------------------
# {angle}

# ------------------------------------------------
# SOURCE OF TRUTH
# ------------------------------------------------

# The provided image is the authoritative design.

# All geometry, structure, and layout must be preserved exactly.


# ------------------------------------------------
# STRUCTURE LOCK
# ------------------------------------------------

# The following elements are permanently locked and must remain identical
# to the input image.

# Geometry

# • overall jewelry silhouette
# • object proportions
# • structural layout
# • symmetry
# • curvature

# Stone Structure

# • stone count
# • stone shapes
# • stone sizes
# • stone spacing
# • stone alignment
# • stone layout pattern

# Setting Details

# • prong count
# • prong positions
# • prong style
# • bezel edges
# • pavé structure
# • channel structures

# Metal Structure

# • band thickness
# • band width
# • pendant frame
# • connectors
# • hooks
# • joints
# • engravings
# • surface patterns


# ------------------------------------------------
# STRICT PRESERVATION RULES
# ------------------------------------------------

# Never perform the following operations:

# • do NOT add stones
# • do NOT remove stones
# • do NOT merge stones
# • do NOT simplify prongs
# • do NOT smooth geometry
# • do NOT change proportions
# • do NOT change symmetry
# • do NOT modify engravings
# • do NOT redesign the jewelry


# ------------------------------------------------
# ALLOWED OPERATIONS
# ------------------------------------------------

# Only the following are allowed:

# • improving material realism
# • improving gemstone sparkle
# • improving metal reflections
# • improving lighting
# • improving rendering quality


# The physical structure must remain identical.


# ------------------------------------------------
# MATERIAL REALISM
# ------------------------------------------------

# Render jewelry using physically accurate materials.

# Metals

# • yellow gold
# • white gold
# • rose gold
# • platinum

# Gemstones

# • diamond
# • ruby
# • emerald
# • sapphire
# • gemstones visible in the image

# Ensure:

# • realistic gemstone refraction
# • gemstone brilliance
# • accurate metal reflections
# • sharp prongs
# • visible stone facets


# ------------------------------------------------
# PHOTOGRAPHY STYLE
# ------------------------------------------------

# Render as luxury commercial jewelry photography.

# Lighting

# • professional studio lighting
# • soft diffused key light
# • controlled reflections
# • gemstone sparkle highlights

# Camera

# • macro lens
# • shallow depth of field
# • sharp focus on jewelry

# Background

# • clean white background
# • luxury soft gradient
# • subtle natural shadow


# ------------------------------------------------
# QUALITY TARGET
# ------------------------------------------------

# The final result must look like a premium product photograph from:

# Cartier
# Tiffany
# Bulgari
# Van Cleef


# ------------------------------------------------
# OUTPUT
# ------------------------------------------------

# Generate ONE image.

# The jewelry design must be identical to the input image.

# Only rendering quality and photographic realism may improve.
# """


# def build_lifestyle_prompt():

#     return """
# ROLE

# You are a luxury jewelry photography engine.

# You are given a jewelry product image that represents the
# final approved jewelry design.

# Your task is to place the exact same jewelry naturally on a person
# and render it as a high-end lifestyle fashion photograph.

# This is NOT a redesign task.


# ------------------------------------------------
# SOURCE OF TRUTH
# ------------------------------------------------

# The provided jewelry image is the authoritative design.

# The jewelry structure must remain identical.


# ------------------------------------------------
# STRUCTURE LOCK
# ------------------------------------------------

# All design elements are permanently locked.

# Preserve exactly:

# Geometry

# • jewelry silhouette
# • proportions
# • symmetry
# • curvature

# Stone Structure

# • stone count
# • stone shapes
# • stone size ratios
# • stone spacing
# • stone alignment
# • stone placement pattern

# Setting Details

# • prong count
# • prong positions
# • prong style
# • bezel edges
# • pavé layout
# • channel structures

# Metal Structure

# • band width
# • band thickness
# • pendant frame
# • connectors
# • hooks
# • joints
# • engravings
# • decorative motifs


# ------------------------------------------------
# STRICT PROHIBITIONS
# ------------------------------------------------

# Never:

# • add stones
# • remove stones
# • merge stones
# • simplify prongs
# • smooth pavé
# • change band thickness
# • modify engravings
# • redesign the jewelry
# • change stone layout


# The jewelry must remain identical to the input image.


# ------------------------------------------------
# ALLOWED OPERATIONS
# ------------------------------------------------

# Only the following changes are allowed:

# • placing the jewelry on a person
# • adjusting orientation to match body position
# • natural skin interaction
# • lighting changes
# • background and environment


# ------------------------------------------------
# PLACEMENT RULES
# ------------------------------------------------

# Place the jewelry correctly depending on type.

# Ring  
# → worn naturally on a finger

# Necklace / Pendant  
# → worn on the neck

# Earrings  
# → worn on the ear

# Bracelet  
# → worn on the wrist

# Brooch  
# → pinned on clothing


# The jewelry must appear physically attached and naturally positioned.


# ------------------------------------------------
# REALISM REQUIREMENTS
# ------------------------------------------------

# Ensure realistic interaction with the human subject.

# • correct scale relative to body
# • natural skin contact
# • natural shadows
# • realistic reflections on metal
# • gemstone sparkle preserved
# • jewelry remains sharply visible


# ------------------------------------------------
# PHOTOGRAPHY STYLE
# ------------------------------------------------

# Luxury fashion lifestyle photography.

# Lighting

# • soft natural lighting
# • fashion editorial lighting
# • realistic highlights on gemstones

# Camera

# • shallow depth of field
# • macro focus on jewelry
# • subject softly blurred

# Environment

# • elegant fashion setting
# • neutral or luxury background
# • clean composition


# ------------------------------------------------
# QUALITY TARGET
# ------------------------------------------------

# The image should look like a professional jewelry
# fashion campaign photograph from brands such as:

# Cartier
# Tiffany
# Bulgari
# Van Cleef


# ------------------------------------------------
# OUTPUT
# ------------------------------------------------

# Generate ONE lifestyle image.

# The jewelry must remain identical to the input image
# while being worn naturally by a person.
# """


# # ---------------------------------------------------
# # GENERATORS
# # ---------------------------------------------------

# def generate_base():

#     logger.info("Generating base design")

#     image_file = load_image_buffer(INPUT_IMAGE)

#     prompt = build_master_prompt(USER_PROMPT)

#     results = []

#     for i in range(BASE_VARIATIONS):

#         result = client.images.edit(
#             model="gpt-image-1.5",
#             image=image_file,
#             prompt=prompt,
#             size="1024x1024",
#             n=1
#         )

#         path = save_image(result.data[0], f"base_{i}", "base")

#         results.append(path)

#         logger.info(f"Base image saved: {path}")

#     return results


# def generate_angles(base_image):

#     logger.info("Generating angles")

#     image_file = load_image_buffer(base_image)

#     angles = [
#         "side profile view",
#         "top-down view"
#     ]

#     results = []

#     for angle in angles:

#         prompt = build_angle_prompt(angle)

#         for i in range(ANGLE_VARIATIONS):

#             result = client.images.edit(
#                 model="gpt-image-1.5",
#                 image=image_file,
#                 prompt=prompt,
#                 size="1024x1024",
#                 n=1
#             )

#             path = save_image(
#                 result.data[0],
#                 f"{angle.replace(' ','_')}_{i}",
#                 "angles"
#             )

#             results.append(path)

#             logger.info(f"{angle} saved: {path}")

#     return results


# def generate_lifestyle(base_image):

#     logger.info("Generating lifestyle image")

#     image_file = load_image_buffer(base_image)

#     prompt = build_lifestyle_prompt()

#     results = []

#     for i in range(LIFESTYLE_VARIATIONS):

#         result = client.images.edit(
#             model="gpt-image-1.5",
#             image=image_file,
#             prompt=prompt,
#             size="1024x1024",
#             n=1
#         )

#         path = save_image(
#             result.data[0],
#             f"lifestyle_{i}",
#             "lifestyle"
#         )

#         results.append(path)

#         logger.info(f"Lifestyle image saved: {path}")

#     return results


# # ---------------------------------------------------
# # PIPELINE
# # ---------------------------------------------------

# def run_pipeline():

#     logger.info("Starting pipeline")

#     bases = generate_base()

#     angles = generate_angles(bases[0])

#     lifestyle = generate_lifestyle(bases[0])

#     print("\nFINAL OUTPUT")
#     print("BASE:", bases)
#     print("ANGLES:", angles)
#     print("LIFESTYLE:", lifestyle)


# # ---------------------------------------------------
# # RUN
# # ---------------------------------------------------

# if __name__ == "__main__":

#     run_pipeline()