"""
OpenAI Jewelry Generation Pipeline v5
Cross-Agent Iterative Refinement Approach
Creates image, compares with base, detects changes, and iteratively refines until perfection
"""

import base64
import io
import logging
import os
import time
from typing import List, Dict, Any, Tuple
from PIL import Image
import openai
from openai import OpenAI
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize OpenAI client
API_KEY = os.environ.get("OPENAI_API_KEY", "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")
client = OpenAI(api_key=API_KEY)

# =========================
# HELPER FUNCTIONS
# =========================
def load_image_bytes(path: str) -> bytes:
    """Load image from local path or URL and return bytes"""
    if not path or (isinstance(path, str) and path.strip() in ["", "-", "n/a", "N/A", "none", "None"]):
        raise ValueError(f"Invalid image path: {path}")

    if path.startswith("http"):
        import requests
        response = requests.get(path)
        response.raise_for_status()
        return response.content
    else:
        if not os.path.exists(path):
            raise FileNotFoundError(f"Image file not found: {path}")
        with open(path, "rb") as f:
            return f.read()

def save_image(image_bytes: bytes, filename: str) -> str:
    """Save image bytes to file and return path"""
    image = Image.open(io.BytesIO(image_bytes))
    image.save(filename)
    return filename

def encode_image_to_base64(image_bytes: bytes) -> str:
    """Encode image bytes to base64 string"""
    return base64.b64encode(image_bytes).decode('utf-8')

# =========================
# CROSS-AGENT FUNCTIONS
# =========================
def analyze_changes_with_vision(base_image_path: str, user_request: str) -> Dict[str, Any]:
    """
    Agent 1: Analyze what changes need to be made using GPT-4o vision
    """
    try:
        image_bytes = load_image_bytes(base_image_path)
        base64_image = encode_image_to_base64(image_bytes)
        
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
        
        response = client.chat.completions.create(
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
                return json.loads(json_str)
        except:
            pass
        
        # Fallback: create basic analysis
        return {
            "changes_needed": [user_request],
            "must_preserve": ["overall_style", "proportions"],
            "complex_elements": [],
            "metal_type": "unknown",
            "stone_type": "unknown",
            "design_style": "jewelry"
        }
        
    except Exception as e:
        logger.warning(f"Vision analysis failed: {e}")
        return {
            "changes_needed": [user_request],
            "must_preserve": ["overall_style"],
            "complex_elements": [],
            "metal_type": "unknown",
            "stone_type": "unknown",
            "design_style": "jewelry"
        }

def generate_initial_image(base_image_path: str, analysis: Dict[str, Any]) -> str:
    """
    Agent 2: Generate initial image with changes
    """
    try:
        # Create detailed prompt based on analysis
        changes_text = ", ".join(analysis["changes_needed"])
        preserve_text = ", ".join(analysis["must_preserve"])
        
        prompt = f"""You are a master jewelry CAD designer. Create a HYPER-REALISTIC jewelry render.

BASE IMAGE: Reference for style and proportions
CHANGES TO IMPLEMENT: {changes_text}
MUST PRESERVE: {preserve_text}

CRITICAL REQUIREMENTS:
- Every curve mathematically perfect - no wavering
- All circles perfectly circular (no oval distortion)
- Perfect bilateral symmetry
- Metal shows micro-surface detail and bright specular highlights
- Stones show brilliance, fire, and scintillation
- All elements properly attached (no floating parts)

LOGICAL ELEMENT ATTACHMENT:
- If text requested: engraved with proper depth (0.3-0.5mm) or raised as part of metal
- If spinning bands: show bearing mechanism and rotation gap
- If stacked bands: separate but cohesive with 0.1-0.2mm gap
- All attached elements show proper connection points

LIGHTING: Professional 5-point studio lighting
BACKGROUND: Pure white
OUTPUT: Ultra-realistic CAD render, Cartier/Tiffany quality"""

        # Generate image
        output_dir = "outputimages/openai_v5"
        os.makedirs(output_dir, exist_ok=True)
        
        # Save temp file for API
        import uuid
        temp_id = uuid.uuid4().hex
        temp_image_path = os.path.join(output_dir, f"temp_input_{temp_id}.png")
        with open(temp_image_path, "wb") as f:
            f.write(load_image_bytes(base_image_path))
        
        with open(temp_image_path, "rb") as image_file:
            response = client.images.edit(
                model="gpt-image-2",
                image=image_file,
                prompt=prompt,
                n=1,
                size="1024x1024"
            )
        
        # Keep temp files for testing - comment out removal
        # os.remove(temp_image_path)
        logger.info(f"Temp file kept: {temp_image_path}")
        
        # Save generated image
        image_data = response.data[0]
        if hasattr(image_data, 'b64_json') and image_data.b64_json:
            image_bytes_out = base64.b64decode(image_data.b64_json)
            filename = f"generated_initial_{uuid.uuid4().hex}.png"
            save_path = os.path.join(output_dir, filename)
            save_image(image_bytes_out, save_path)
            logger.info(f"Initial image generated: {save_path}")
            return save_path
        
        return None
        
    except Exception as e:
        logger.error(f"Initial generation failed: {e}")
        return None

def compare_and_validate(base_image_path: str, generated_image_path: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
    """
    Agent 3: Compare generated image with requirements and identify issues
    """
    try:
        # Load both images
        base_bytes = load_image_bytes(base_image_path)
        generated_bytes = load_image_bytes(generated_image_path)
        
        base64_base = encode_image_to_base64(base_bytes)
        base64_generated = encode_image_to_base64(generated_bytes)
        
        changes_text = ", ".join(analysis["changes_needed"])
        
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
        
        response = client.chat.completions.create(
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
                return json.loads(json_str)
        except:
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
        logger.warning(f"Comparison failed: {e}")
        return {
            "changes_implemented": [],
            "missing_changes": ["unknown"],
            "quality_issues": ["comparison_failed"],
            "needs_refinement": True,
            "refinement_notes": "Unable to compare, need to regenerate"
        }

def refine_image(generated_image_path: str, validation: Dict[str, Any], analysis: Dict[str, Any]) -> str:
    """
    Agent 4: Refine the image based on validation feedback
    """
    try:
        # Create refinement prompt
        missing_changes = ", ".join(validation["missing_changes"])
        quality_issues = ", ".join(validation["quality_issues"])
        refinement_notes = validation["refinement_notes"]
        
        prompt = f"""You are refining a jewelry CAD render to fix issues.

CURRENT IMAGE: The image to be refined
ISSUES TO FIX: {missing_changes}
QUALITY PROBLEMS: {quality_issues}
SPECIFIC NOTES: {refinement_notes}

CRITICAL FIXES NEEDED:
- Ensure all requested changes are implemented
- Fix any floating or improperly attached elements
- Complete any incomplete bands or circles
- Ensure perfect symmetry and geometry
- Fix text/numerals if present (spell exactly, proper depth)
- Fix spinning band mechanisms if present
- Ensure stacked bands have proper gaps

RENDERING STANDARDS:
- Mathematically perfect curves
- Bright specular highlights on metal
- Stone brilliance and fire
- Professional studio lighting
- Pure white background

Generate the perfected version addressing all issues."""

        # Generate refined image
        output_dir = "outputimages/openai_v5"
        os.makedirs(output_dir, exist_ok=True)
        
        # Save temp file
        import uuid
        temp_id = uuid.uuid4().hex
        temp_image_path = os.path.join(output_dir, f"temp_refine_{temp_id}.png")
        with open(temp_image_path, "wb") as f:
            f.write(load_image_bytes(generated_image_path))
        
        with open(temp_image_path, "rb") as image_file:
            response = client.images.edit(
                model="gpt-image-2",
                image=image_file,
                prompt=prompt,
                n=1,
                size="1024x1024"
            )
        
        # Keep temp files for testing - comment out removal
        # os.remove(temp_image_path)
        logger.info(f"Temp file kept: {temp_image_path}")
        
        # Save refined image
        image_data = response.data[0]
        if hasattr(image_data, 'b64_json') and image_data.b64_json:
            image_bytes_out = base64.b64decode(image_data.b64_json)
            filename = f"generated_refined_{uuid.uuid4().hex}.png"
            save_path = os.path.join(output_dir, filename)
            save_image(image_bytes_out, save_path)
            logger.info(f"Refined image generated: {save_path}")
            return save_path
        
        return None
        
    except Exception as e:
        logger.error(f"Refinement failed: {e}")
        return None

# =========================
# MAIN PIPELINE
# =========================
def generate_jewelry_with_cross_agent(
    base_image_path: str,
    user_request: str,
    max_iterations: int = 3
) -> List[str]:
    """
    Cross-agent iterative refinement pipeline
    """
    logger.info(f"Starting cross-agent jewelry generation")
    logger.info(f"Request: {user_request}")
    
    generated_images = []
    
    # Agent 1: Analyze requirements
    logger.info("🔍 Agent 1: Analyzing requirements with vision...")
    analysis = analyze_changes_with_vision(base_image_path, user_request)
    logger.info(f"Changes needed: {analysis['changes_needed']}")
    logger.info(f"Must preserve: {analysis['must_preserve']}")
    
    # Agent 2: Generate initial image
    logger.info("🎨 Agent 2: Generating initial image...")
    current_image = generate_initial_image(base_image_path, analysis)
    
    if not current_image:
        logger.error("Initial generation failed")
        return []
    
    generated_images.append(current_image)
    
    # Iterative refinement loop
    for iteration in range(max_iterations):
        logger.info(f"🔄 Iteration {iteration + 1}/{max_iterations}")
        
        # Agent 3: Compare and validate
        logger.info("🔍 Agent 3: Comparing and validating...")
        validation = compare_and_validate(base_image_path, current_image, analysis)
        
        logger.info(f"Changes implemented: {len(validation['changes_implemented'])}")
        logger.info(f"Missing changes: {len(validation['missing_changes'])}")
        logger.info(f"Quality issues: {len(validation['quality_issues'])}")
        
        # Check if refinement is needed
        if not validation["needs_refinement"]:
            logger.info("✅ Image meets all requirements!")
            break
        
        if iteration < max_iterations - 1:
            # Agent 4: Refine the image
            logger.info("🔧 Agent 4: Refining image...")
            refined_image = refine_image(current_image, validation, analysis)
            
            if refined_image:
                current_image = refined_image
                generated_images.append(current_image)
            else:
                logger.warning("Refinement failed, continuing with current image")
    
    logger.info(f"🎉 Cross-agent generation complete!")
    logger.info(f"Generated {len(generated_images)} images in the process")
    
    return generated_images

# =========================
# MULTI-ANGLE GENERATION
# =========================
def generate_multi_angle_with_cross_agent(
    base_image_path: str,
    user_request: str,
    angles: List[str] = ["front", "back", "side", "45-degree"]
) -> Dict[str, List[str]]:
    """
    Generate multiple angles using cross-agent approach for each
    """
    logger.info(f"Starting multi-angle generation with cross-agent refinement")
    
    all_results = {}
    
    for angle in angles:
        logger.info(f"\n{'='*50}")
        logger.info(f"Generating {angle} view")
        logger.info(f"{'='*50}")
        
        # Adjust prompt for angle
        angle_request = f"{user_request} - {angle} view"
        
        # Generate with cross-agent
        angle_images = generate_jewelry_with_cross_agent(
            base_image_path,
            angle_request,
            max_iterations=2  # Fewer iterations for angles to save time
        )
        
        all_results[angle] = angle_images
    
    return all_results

# =========================
# MAIN EXECUTION
# =========================
if __name__ == "__main__":
    print("🚀 Jewelry CAD Generator v5 — Cross-Agent Iterative Refinement")
    
    # Set your input image path
    input_path = "test16.png"
    
    # Set your user prompt for modifications
    user_prompt = "Need to design an eternity band like this size 13 but three rows of numerals that spin (like the spinning center rings) the outside and center row"
    
    # Set output directory
    output_dir = "outputimages/openai_v5"
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"📥 Input:   {input_path}")
    print(f"✏️  Request: {user_prompt}")
    print(f"📁 Output:  {output_dir}")
    
    try:
        start_time = time.time()
        
        # Option 1: Single image with refinement
        print("\n🎯 Option 1: Single image with iterative refinement")
        results = generate_jewelry_with_cross_agent(
            input_path, 
            user_prompt,
            max_iterations=3
        )
        
        # Option 2: Multi-angle (commented out by default)
        # print("\n🎯 Option 2: Multi-angle generation")
        # multi_results = generate_multi_angle_with_cross_agent(
        #     input_path,
        #     user_prompt,
        #     angles=["front", "back", "side", "45-degree"]
        # )
        
        total_time = time.time() - start_time
        
        print(f"\n✅ Generation complete in {total_time:.2f}s")
        print(f"📂 Generated {len(results)} images:")
        for i, path in enumerate(results, 1):
            print(f"   {i}. {path}")
            
        # Show final result
        if results:
            print(f"\n🏆 Final refined image: {results[-1]}")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
