"""Endpoint for downloading design variant render images."""

import io
import zipfile
import requests
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.repositories.design_variant import DesignVariantRepository


router = APIRouter()


class DownloadRenderRequest(BaseModel):
    """Request body for downloading design variant render image."""
    
    metal_variation_names: Optional[List[str]] = Field(
        None,
        description="List of metal variation names to filter metal_variations_json. If provided, returns images for these specific metal variations."
    )
    
    angle: Optional[str] = Field(
        None,
        description="Optional angle name to filter angles_json. If provided, returns the image for this specific viewing angle."
    )


@router.post(
    "/download-render/{variant_id}",
    status_code=status.HTTP_200_OK,
)
def download_variant_render(
    variant_id: int,
    payload: DownloadRenderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Download design variant render images.

    Returns all images filtered by metal_variation_names and/or angle.
    If both filters are provided, returns images matching either filter (OR logic).
    If no filters provided, returns the base design image.

    Args:
        variant_id: ID of the design variant
        payload: Request body containing optional metal_variation_names and angle for filtering
        db: Database session
        current_user: Authenticated user

    Returns:
        Response: ZIP file containing all matching images as .jpg files

    Raises:
        HTTPException: If variant not found or image retrieval fails
    """
    try:
        variant_repo = DesignVariantRepository(db)
        variant = variant_repo.get_by_id(variant_id)
        
        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Design variant with id {variant_id} not found"
            )
        
        # Collect all matching image URLs
        image_urls = []
        
        # Helper function to extract URL from value (handles both strings and dicts)
        def extract_url(url_value):
            if isinstance(url_value, dict):
                return url_value.get("image_url")
            return url_value
        
        # Filter by angle if provided
        if payload.angle and variant.angles_json:
            if isinstance(variant.angles_json, dict):
                url_value = variant.angles_json.get(payload.angle)
                if url_value:
                    extracted_url = extract_url(url_value)
                    if extracted_url:
                        image_urls.append(extracted_url)
            elif isinstance(variant.angles_json, list):
                for item in variant.angles_json:
                    if isinstance(item, dict) and item.get("angle") == payload.angle:
                        extracted_url = extract_url(item.get("image_url"))
                        if extracted_url:
                            image_urls.append(extracted_url)
        
        # Filter by metal_variation_names if provided
        if payload.metal_variation_names and variant.metal_variations_json:
            for metal_name in payload.metal_variation_names:
                if isinstance(variant.metal_variations_json, dict):
                    if metal_name in variant.metal_variations_json:
                        url_value = variant.metal_variations_json[metal_name]
                        extracted_url = extract_url(url_value)
                        if extracted_url and extracted_url not in image_urls:
                            image_urls.append(extracted_url)
                elif isinstance(variant.metal_variations_json, list):
                    for item in variant.metal_variations_json:
                        if isinstance(item, dict) and item.get("metal_type") == metal_name:
                            extracted_url = extract_url(item.get("image_url"))
                            if extracted_url and extracted_url not in image_urls:
                                image_urls.append(extracted_url)
        
        # If no filters provided, use base design image
        if not image_urls:
            url_value = variant.base_design_image_url
            extracted_url = extract_url(url_value)
            if extracted_url:
                image_urls.append(extracted_url)
        
        if not image_urls:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No images found for this variant with the given filters"
            )
        
        # Fetch all images and create ZIP file with .jpg files
        try:
            zip_buffer = io.BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for idx, image_url in enumerate(image_urls):
                    # Final safety check: if image_url is still a dict, extract image_url
                    if isinstance(image_url, dict):
                        image_url = image_url.get("image_url")
                    
                    if not image_url or not isinstance(image_url, str):
                        continue
                    
                    # Clean the URL by stripping trailing quotes and special characters
                    cleaned_url = image_url.strip().strip('"').strip("'")
                    # Also strip URL-encoded quotes (%22 for ", %27 for ')
                    cleaned_url = cleaned_url.rstrip('%22').rstrip('%27')
                    
                    try:
                        response = requests.get(cleaned_url, timeout=30)
                        response.raise_for_status()
                        image_bytes = response.content
                        
                        # Generate filename - always use .jpg extension
                        filename_parts = [f"variant_{variant_id}"]
                        if payload.angle:
                            filename_parts.append(f"angle_{payload.angle}")
                        if payload.metal_variation_names:
                            filename_parts.append(f"metal_{payload.metal_variation_names[0]}")
                        filename_parts.append(f"image_{idx+1}.jpg")
                        filename = "_".join(filename_parts)
                        
                        # Add to ZIP as .jpg
                        zip_file.writestr(filename, image_bytes)
                        
                    except requests.RequestException as e:
                        # Log error but continue with other images
                        print(f"Failed to fetch image {cleaned_url}: {str(e)}")
                        continue
            
            # Check if any images were successfully added
            if zip_buffer.tell() == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to fetch any images from the provided URLs"
                )
            
            zip_buffer.seek(0)
            zip_bytes = zip_buffer.getvalue()
            
            # Generate ZIP filename
            zip_filename_parts = [f"variant_{variant_id}"]
            if payload.angle:
                zip_filename_parts.append(f"angle_{payload.angle}")
            if payload.metal_variation_names:
                zip_filename_parts.append(f"metal_{payload.metal_variation_names[0]}")
            zip_filename_parts.append("images.zip")
            zip_filename = "_".join(zip_filename_parts)
            
            return Response(
                content=zip_bytes,
                media_type='application/zip',
                headers={
                    "Content-Disposition": f"attachment; filename={zip_filename}"
                }
            )
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create ZIP file: {str(e)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download render: {str(e)}"
        )
