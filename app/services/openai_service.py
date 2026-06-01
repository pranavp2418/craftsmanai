"""
OpenAI Service - Single client instance with reusable image generation functions

This service provides a centralized OpenAI client and functions for different
image generation types (base, side, angles, lifestyle, etc.).
"""

import logging
import os
import base64
import uuid
from io import BytesIO
from typing import Optional, List

import requests
from PIL import Image
from openai import OpenAI
from dotenv import load_dotenv

from app.core.config import settings

load_dotenv()

logger = logging.getLogger(__name__)


class OpenAIService:
    """
    Singleton OpenAI service with a single client instance.
    
    Provides reusable functions for different image generation types:
    - Base image generation
    - Side view generation
    - Multiple angles generation
    - Lifestyle image generation
    """
    
    _instance = None
    _client = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize_client()
        return cls._instance
    
    def _initialize_client(self):
        """Initialize the OpenAI client (called only once)."""
        if not self._client:
            api_key = os.getenv("OPENAI_API_KEY") or settings.OPENAI_API_KEY
            if not api_key:
                raise ValueError("OPENAI_API_KEY not found in environment variables")
            self._client = OpenAI(api_key=api_key)
            logger.info("OpenAI client initialized")
    
    @property
    def client(self):
        """Get the OpenAI client instance."""
        return self._client

    @property
    def model(self) -> str:
        """Get the image generation model used by OpenAI."""
        return settings.OPENAI_IMAGE_MODEL or "gpt-image-1.5"
    
    def _load_image_buffer_from_source(self, source: str) -> tuple:
        """
        Load image from URL or local path and convert to buffer.
        
        Args:
            source: URL or local file path
            
        Returns:
            Tuple of (filename, buffer, content_type)
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
    
    def _build_master_prompt(self, user_prompt: str, jewellery_type: str = "") -> str:
        """Build the master prompt for base image generation."""
        jewellery_hint = (
            f"\n\nCRITICAL: This is a {jewellery_type} design. You MUST generate a {jewellery_type}. "
            f"Do NOT change the jewelry type. Keep the {jewellery_type} structure intact."
            if jewellery_type else ""
        )
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
USER REQUIREMENTS
------------------------------------------------

{user_prompt}
{jewellery_hint}
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
    
    def _build_angle_prompt(self, angle: str, jewellery_type: str = "") -> str:
        """Build prompt for angle-specific generation."""
        jewellery_hint = (
            f"\n\nCRITICAL: This is a {jewellery_type} design. You MUST generate a {jewellery_type}. "
            f"Do NOT change the jewelry type. Keep the {jewellery_type} structure intact."
            if jewellery_type else ""
        )
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
    
    def generate_base_image(
        self,
        image_source: str,
        user_prompt: str,
        jewellery_type: str = "",
        size: str = "1024x1024"
    ) -> str:
        """
        Generate base image from reference image and user prompt.
        
        Args:
            image_source: URL or local path of reference image
            user_prompt: User's design requirements
            jewellery_type: Type of jewelry (ring, pendant, bracelet, etc.)
            size: Output image size (default: 1024x1024)
            
        Returns:
            Supabase URL of the generated image
        """
        logger.info("Generating base image")
        
        image_file = self._load_image_buffer_from_source(image_source)
        prompt = self._build_master_prompt(user_prompt, jewellery_type=jewellery_type)
        
        result = self._client.images.edit(
            model=self.model,
            image=image_file,
            prompt=prompt,
            size=size,
            n=1
        )
        
        logger.info("Base image generated successfully")
        return result.data[0]
    
    def generate_side_view(
        self,
        base_image_source: str,
        angle_description: str = "rotate 90 degrees to the right, full side profile view, camera at same height",
        jewellery_type: str = "",
        size: str = "1024x1024"
    ) -> str:
        """
        Generate side view from base image.
        
        Args:
            base_image_source: URL or local path of base image
            angle_description: Description of the desired angle
            jewellery_type: Type of jewelry (ring, pendant, bracelet, etc.)
            size: Output image size (default: 1024x1024)
            
        Returns:
            Supabase URL of the generated image
        """
        logger.info("Generating side view")
        
        image_file = self._load_image_buffer_from_source(base_image_source)
        prompt = self._build_angle_prompt(angle_description, jewellery_type=jewellery_type)
        
        result = self._client.images.edit(
            model=self.model,
            image=image_file,
            prompt=prompt,
            size=size,
            n=1
        )
        
        logger.info("Side view generated successfully")
        return result.data[0]
    
    def generate_top_view(
        self,
        base_image_source: str,
        angle_description: str = "top-down view, camera positioned directly above at 90 degrees looking down",
        jewellery_type: str = "",
        size: str = "1024x1024"
    ) -> str:
        """
        Generate top view from base image.
        
        Args:
            base_image_source: URL or local path of base image
            angle_description: Description of the desired angle
            jewellery_type: Type of jewelry (ring, pendant, bracelet, etc.)
            size: Output image size (default: 1024x1024)
            
        Returns:
            Supabase URL of the generated image
        """
        logger.info("Generating top view")
        
        image_file = self._load_image_buffer_from_source(base_image_source)
        prompt = self._build_angle_prompt(angle_description, jewellery_type=jewellery_type)
        
        result = self._client.images.edit(
            model=self.model,
            image=image_file,
            prompt=prompt,
            size=size,
            n=1
        )
        
        logger.info("Top view generated successfully")
        return result.data[0]
    
    def generate_custom_angle(
        self,
        base_image_source: str,
        angle_description: str,
        jewellery_type: str = "",
        size: str = "1024x1024"
    ) -> str:
        """
        Generate custom angle view from base image.
        
        Args:
            base_image_source: URL or local path of base image
            angle_description: Custom description of the desired angle
            jewellery_type: Type of jewelry (ring, pendant, bracelet, etc.)
            size: Output image size (default: 1024x1024)
            
        Returns:
            Supabase URL of the generated image
        """
        logger.info(f"Generating custom angle: {angle_description}")
        
        image_file = self._load_image_buffer_from_source(base_image_source)
        prompt = self._build_angle_prompt(angle_description, jewellery_type=jewellery_type)
        
        result = self._client.images.edit(
            model=self.model,
            image=image_file,
            prompt=prompt,
            size=size,
            n=1
        )
        
        logger.info("Custom angle generated successfully")
        return result.data[0]

    def transcribe_audio(self, file_content: bytes, filename: str) -> str:
        """
        Transcribe audio using OpenAI Whisper API.
        
        Args:
            file_content: Raw bytes of the audio file
            filename: Name of the file (must have extension like .mp3, .wav, .webm, etc.)
            
        Returns:
            Transcribed text
        """
        logger.info(f"Transcribing audio file: {filename}")
        
        # Whisper API expects a tuple with (filename, file_content) or file-like object
        # Using a tuple is the standard approach for passing bytes to OpenAI file uploads
        file_tuple = (filename, file_content)
        
        result = self._client.audio.transcriptions.create(
            model="whisper-1",
            file=file_tuple,
            language="en",
            prompt="The user is providing instructions for jewelry design modifications. Please transcribe exactly what is said. Avoid generating random words if the audio is silent or unclear."
        )
        
        logger.info("Audio transcribed successfully")
        return result.text

    def generate_image_from_prompt(
        self,
        user_prompt: str,
        size: str = "1024x1024"
    ) -> str:
        """
        Generate image using prompt only (no reference image).
        
        Args:
            user_prompt: User's design requirements
            size: Output image size (default: 1024x1024)
            
        Returns:
            OpenAI image object/URL response
        """
        logger.info("Generating image from prompt only")
        prompt = self._build_master_prompt(user_prompt)
        
        result = self._client.images.generate(
            model=getattr(settings, "OPENAI_TEXT_TO_IMAGE_MODEL", "gpt-image-2"),
            prompt=prompt,
            size=size,
            n=1
        )
        
        logger.info("Prompt-only image generated successfully")
        return result.data[0]


    def _load_image_bytes_from_source(self, source: str) -> bytes:
        """Load image bytes from URL or local path."""
        if source.startswith("http"):
            import requests as req
            resp = req.get(source)
            resp.raise_for_status()
            return resp.content
        with open(source, "rb") as f:
            return f.read()

    def _encode_image_to_base64(self, image_bytes: bytes) -> str:
        """Encode image bytes to base64 string."""
        return base64.b64encode(image_bytes).decode('utf-8')

    def analyze_changes_with_vision(
        self,
        image_source: str,
        user_request: str,
    ) -> dict:
        """
        Agent 1: Analyze what changes need to be made using GPT-4o vision.
        
        Args:
            image_source: URL or local path of reference image
            user_request: User's design modification request
            
        Returns:
            dict with keys: changes_needed, must_preserve, complex_elements, metal_type, stone_type, design_style
        """
        logger.info("Analyzing changes with vision for request: %s", user_request)
        try:
            image_bytes = self._load_image_bytes_from_source(image_source)
            base64_image = self._encode_image_to_base64(image_bytes)

            messages = [
                {
                    "role": "system",
                    "content": """You are a master jewelry designer analyzing images for modifications. 
                    
Your task:
1. Examine the reference jewelry image carefully
2. Parse the user's modification request
3. Identify EXACTLY what needs to change
4. Specify what must remain unchanged
5. Note any complex elements (text, spinning parts, stacked bands)

Output format:
{
  "changes_needed": ["list of specific changes"],
  "must_preserve": ["list of elements to keep exactly"],
  "complex_elements": ["text", "spinning_bands", "stacked_bands", etc.],
  "metal_type": "detected or specified",
  "stone_type": "detected or specified",
  "design_style": "brief description"
}"""
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Analyze this jewelry image and the user's request: '{user_request}'\n\nProvide a detailed JSON analysis of what needs to change and what must be preserved."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ]

            response = self._client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=500,
                temperature=0.3
            )

            analysis_text = response.choices[0].message.content.strip()

            # Try to extract JSON from response
            try:
                start_idx = analysis_text.find('{')
                end_idx = analysis_text.rfind('}') + 1
                if start_idx != -1 and end_idx != 0:
                    json_str = analysis_text[start_idx:end_idx]
                    import json
                    return json.loads(json_str)
            except Exception:
                pass

            # Fallback
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
        Agent 3: Compare generated image with requirements and identify issues.
        
        Args:
            base_image_source: URL or local path of reference base image
            generated_image_source: URL or local path of generated image
            analysis: Analysis dict from analyze_changes_with_vision()
            
        Returns:
            dict with keys: changes_implemented, missing_changes, quality_issues, needs_refinement, refinement_notes
        """
        logger.info("Comparing and validating generated image")
        try:
            base_bytes = self._load_image_bytes_from_source(base_image_source)
            generated_bytes = self._load_image_bytes_from_source(generated_image_source)

            base64_base = self._encode_image_to_base64(base_bytes)
            base64_generated = self._encode_image_to_base64(generated_bytes)

            changes_text = ", ".join(analysis.get("changes_needed", []))

            messages = [
                {
                    "role": "system",
                    "content": """You are a quality control expert for jewelry CAD renders.

Your task:
1. Compare the base image with the generated image
2. Verify all requested changes are implemented
3. Check for quality issues (floating elements, incomplete bands, etc.)
4. Identify what needs refinement

Output format:
{
  "changes_implemented": ["list of successfully implemented changes"],
  "missing_changes": ["list of changes not implemented"],
  "quality_issues": ["list of quality problems"],
  "needs_refinement": true/false,
  "refinement_notes": "specific instructions for next iteration"
}"""
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Compare these images. Base (left) vs Generated (right). Required changes: {changes_text}\n\nAnalyze if all changes are implemented and identify any quality issues."
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
            ]

            response = self._client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=500,
                temperature=0.3
            )

            comparison_text = response.choices[0].message.content.strip()

            # Try to extract JSON
            try:
                start_idx = comparison_text.find('{')
                end_idx = comparison_text.rfind('}') + 1
                if start_idx != -1 and end_idx != 0:
                    json_str = comparison_text[start_idx:end_idx]
                    import json
                    return json.loads(json_str)
            except Exception:
                pass

            # Fallback assessment
            needs_refinement = "incomplete" in comparison_text.lower() or "missing" in comparison_text.lower()
            return {
                "changes_implemented": ["basic_changes"],
                "missing_changes": [] if not needs_refinement else ["some_changes"],
                "quality_issues": [] if not needs_refinement else ["needs_improvement"],
                "needs_refinement": needs_refinement,
                "refinement_notes": comparison_text
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


# Singleton instance
openai_service = OpenAIService()
