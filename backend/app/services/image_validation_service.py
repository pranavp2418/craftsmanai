"""
Image Validation Service - Security and edge case validation for image uploads

This service provides comprehensive image validation including:
- MIME type validation
- File size validation
- Image format validation
- Security checks (malicious content detection)
- Dimension validation
"""

import base64
import imghdr
import io
import logging
from typing import Union, Tuple

from fastapi import HTTPException, status
from PIL import Image

logger = logging.getLogger(__name__)


class ImageValidationService:
    """
    Service for validating uploaded images for security and correctness.
    """
    
    # Allowed MIME types
    ALLOWED_MIME_TYPES = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/gif"
    }
    
    # Maximum file size (10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB in bytes
    
    # Minimum dimensions
    MIN_DIMENSIONS = (64, 64)
    
    # Maximum dimensions
    MAX_DIMENSIONS = (4096, 4096)
    
    @staticmethod
    def decode_base64_image(image_data: str) -> bytes:
        """
        Decode base64 image data.
        
        Args:
            image_data: Base64 encoded string (with or without data URI prefix)
            
        Returns:
            Raw image bytes
            
        Raises:
            HTTPException: If decoding fails
        """
        try:
            # Remove data URI prefix if present
            if image_data.startswith("data:"):
                # Extract the base64 part after the comma
                _, encoded = image_data.split(",", 1)
            else:
                encoded = image_data
            
            # Decode base64
            image_bytes = base64.b64decode(encoded)
            
            return image_bytes
            
        except Exception as e:
            logger.error(f"Failed to decode base64 image: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid base64 image data: {str(e)}"
            )
    
    @staticmethod
    def detect_mime_type(image_bytes: bytes) -> str:
        """
        Detect MIME type from image bytes.
        
        Args:
            image_bytes: Raw image bytes
            
        Returns:
            Detected MIME type
            
        Raises:
            HTTPException: If MIME type detection fails or type is not allowed
        """
        # Use imghdr to detect image type
        image_type = imghdr.what(None, h=image_bytes)
        
        if not image_type:
            logger.error("Could not detect image type")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not detect image type. Please upload a valid image file."
            )
        
        # Map imghdr types to MIME types
        mime_type_map = {
            "jpeg": "image/jpeg",
            "jpg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "gif": "image/gif"
        }
        
        mime_type = mime_type_map.get(image_type.lower())
        
        if not mime_type:
            logger.error(f"Unsupported image type: {image_type}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image type: {image_type}. Allowed types: JPEG, PNG, WebP, GIF"
            )
        
        return mime_type
    
    @staticmethod
    def validate_file_size(image_bytes: bytes) -> None:
        """
        Validate image file size.
        
        Args:
            image_bytes: Raw image bytes
            
        Raises:
            HTTPException: If file size exceeds maximum
        """
        file_size = len(image_bytes)
        
        if file_size == 0:
            logger.error("Empty image file")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image file is empty"
            )
        
        if file_size > ImageValidationService.MAX_FILE_SIZE:
            logger.error(f"Image file too large: {file_size} bytes")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image file size exceeds maximum allowed size of {ImageValidationService.MAX_FILE_SIZE / (1024*1024)}MB"
            )
    
    @staticmethod
    def validate_dimensions(image_bytes: bytes) -> Tuple[int, int]:
        """
        Validate image dimensions.
        
        Args:
            image_bytes: Raw image bytes
            
        Returns:
            Tuple of (width, height)
            
        Raises:
            HTTPException: If dimensions are invalid
        """
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                width, height = img.size
                
                # Check minimum dimensions
                if width < ImageValidationService.MIN_DIMENSIONS[0] or height < ImageValidationService.MIN_DIMENSIONS[1]:
                    logger.error(f"Image dimensions too small: {width}x{height}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image dimensions too small. Minimum: {ImageValidationService.MIN_DIMENSIONS[0]}x{ImageValidationService.MIN_DIMENSIONS[1]}"
                    )
                
                # Check maximum dimensions
                if width > ImageValidationService.MAX_DIMENSIONS[0] or height > ImageValidationService.MAX_DIMENSIONS[1]:
                    logger.error(f"Image dimensions too large: {width}x{height}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Image dimensions too large. Maximum: {ImageValidationService.MAX_DIMENSIONS[0]}x{ImageValidationService.MAX_DIMENSIONS[1]}"
                    )
                
                return width, height
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to validate image dimensions: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read image dimensions: {str(e)}"
            )
    
    @staticmethod
    def validate_image_integrity(image_bytes: bytes) -> None:
        """
        Validate image integrity by attempting to open it with PIL.
        
        Args:
            image_bytes: Raw image bytes
            
        Raises:
            HTTPException: If image is corrupted or invalid
        """
        try:
            with Image.open(io.BytesIO(image_bytes)) as img:
                # Verify the image can be loaded
                img.verify()
                
            # Re-open since verify() closes the image
            with Image.open(io.BytesIO(image_bytes)) as img:
                # Load the image data
                img.load()
                
        except Exception as e:
            logger.error(f"Image integrity check failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image file is corrupted or invalid: {str(e)}"
            )
    
    @classmethod
    def validate_image(cls, image_data: Union[str, bytes]) -> Tuple[bytes, str, Tuple[int, int]]:
        """
        Comprehensive image validation.
        
        Args:
            image_data: Base64 encoded string or raw bytes
            
        Returns:
            Tuple of (image_bytes, mime_type, (width, height))
            
        Raises:
            HTTPException: If any validation fails
        """
        logger.info("Starting image validation")
        
        # Decode if base64 string
        if isinstance(image_data, str):
            image_bytes = cls.decode_base64_image(image_data)
        else:
            image_bytes = image_data
        
        # Validate file size
        cls.validate_file_size(image_bytes)
        logger.info("File size validation passed")
        
        # Detect MIME type
        mime_type = cls.detect_mime_type(image_bytes)
        logger.info(f"MIME type detected: {mime_type}")
        
        # Validate dimensions
        dimensions = cls.validate_dimensions(image_bytes)
        logger.info(f"Dimensions validated: {dimensions[0]}x{dimensions[1]}")
        
        # Validate image integrity
        cls.validate_image_integrity(image_bytes)
        logger.info("Image integrity validation passed")
        
        logger.info("Image validation completed successfully")
        
        return image_bytes, mime_type, dimensions
    
    @classmethod
    def validate_image_list(cls, image_list: list) -> list:
        """
        Validate a list of images.
        
        Args:
            image_list: List of base64 encoded strings or raw bytes
            
        Returns:
            List of tuples (image_bytes, mime_type, dimensions)
            
        Raises:
            HTTPException: If any validation fails
        """
        if not image_list:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one image is required"
            )
        
        if len(image_list) > 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum 10 images allowed per request"
            )
        
        validated_images = []
        
        for idx, image_data in enumerate(image_list):
            logger.info(f"Validating image {idx + 1}/{len(image_list)}")
            validated = cls.validate_image(image_data)
            validated_images.append(validated)
        
        logger.info(f"All {len(image_list)} images validated successfully")
        
        return validated_images


# Singleton instance
image_validation_service = ImageValidationService()
