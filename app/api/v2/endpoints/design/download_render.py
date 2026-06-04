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
    """Download design variant render image.

    Filters by metal_variation_names and/or angle, and downloads the first matched image directly.

    Args:
        variant_id: ID of the design variant
        payload: Request body containing optional filters
        db: Database session
        current_user: Authenticated user

    Returns:
        Response: Single downloaded image file
    """
    try:
        variant_repo = DesignVariantRepository(db)
        variant = variant_repo.get_by_id(variant_id)
        
        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Design variant with id {variant_id} not found"
            )
        
        image_urls = []
        
        def extract_url(url_value):
            if isinstance(url_value, dict):
                return url_value.get("image_url")
            return url_value
            
        # Filter by metal_variation_names
        if payload.metal_variation_names and variant.metal_variations_json:
            for metal_name in payload.metal_variation_names:
                if isinstance(variant.metal_variations_json, dict) and metal_name in variant.metal_variations_json:
                    extracted_url = extract_url(variant.metal_variations_json[metal_name])
                    if extracted_url and extracted_url not in image_urls:
                        image_urls.append(extracted_url)
                        
        # Filter by angle
        if payload.angle and variant.angles_json:
            if isinstance(variant.angles_json, dict):
                # Check if angle is a top-level key (e.g. metal name)
                if payload.angle in variant.angles_json:
                    val = variant.angles_json[payload.angle]
                    if isinstance(val, dict):
                        for view, view_url in val.items():
                            extracted_url = extract_url(view_url)
                            if extracted_url and extracted_url not in image_urls:
                                image_urls.append(extracted_url)
                    else:
                        extracted_url = extract_url(val)
                        if extracted_url and extracted_url not in image_urls:
                            image_urls.append(extracted_url)
                else:
                    # Check if angle is a nested key (e.g. view name like 'side_view')
                    for metal_key, metal_dict in variant.angles_json.items():
                        if isinstance(metal_dict, dict) and payload.angle in metal_dict:
                            extracted_url = extract_url(metal_dict[payload.angle])
                            if extracted_url and extracted_url not in image_urls:
                                image_urls.append(extracted_url)
                                
        # If no filters provided or no match, use base design image
        if not image_urls:
            extracted_url = extract_url(variant.base_design_image_url)
            if extracted_url:
                image_urls.append(extracted_url)
                
        if not image_urls:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No images found for this variant with the given filters"
            )
            
        # Download the first matching image
        url_to_download = image_urls[0]
        cleaned_url = url_to_download.strip().strip('"').strip("'").rstrip('%22').rstrip('%27')
        
        try:
            response = requests.get(cleaned_url, timeout=30)
            response.raise_for_status()
            image_bytes = response.content
            
            # Determine extension
            ext = ".png"
            if ".jpg" in cleaned_url.lower() or ".jpeg" in cleaned_url.lower():
                ext = ".jpg"
                
            filename_parts = [f"variant_{variant_id}"]
            if payload.metal_variation_names:
                filename_parts.append(f"metal_{payload.metal_variation_names[0]}")
            if payload.angle:
                filename_parts.append(f"angle_{payload.angle}")
            
            filename = "_".join(filename_parts) + ext
            media_type = "image/jpeg" if ext == ".jpg" else "image/png"
            
            return Response(
                content=image_bytes,
                media_type=media_type,
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
            
        except requests.RequestException as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to download image from {cleaned_url}: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process download request: {str(e)}"
        )
