"""
Storage service for file uploads.
 
Provides a single upload function that abstracts the underlying storage provider.
Currently uses Supabase Storage, but can be swapped to AWS S3 or any other
provider by changing only this module.
 
Usage:
    from app.services.storage_service import upload_image_to_supabase
 
    # Upload bytes or base64 string
    url = upload_image_to_supabase(image_data, "designs/user_123/variant_1.png")
"""
 
import base64
import imghdr
import logging
import mimetypes
import os
import uuid
from typing import Union

import requests
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)
 
 
def _detect_content_type(image: Union[str, bytes]) -> str:
    """Detect image content type from the input."""
    if isinstance(image, str):
        # Base64 string - try to extract mime from data URI prefix
        if image.startswith("data:"):
            return image.split(";")[0].split(":")[1]
        # Assume PNG for raw base64 strings
        return "image/png"
    # Bytes - try to detect from magic bytes
    if image[:4] == b"\x89PNG":
        return "image/png"
    if image[:2] == b"\xff\xd8":
        return "image/jpeg"
    if image[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if image[:4] == b"RIFF" and image[8:12] == b"WEBP":
        return "image/webp"
    return "image/png"  # default fallback
 
 
def _decode_image(image: Union[str, bytes]) -> tuple[bytes, str]:
    """
    Decode the image input into raw bytes and content type.

    Accepts:
        - bytes: raw image bytes
        - str: base64-encoded string (with or without data URI prefix)
        - str: HTTP/HTTPS URL to an image
    """
    if isinstance(image, bytes):
        return image, _detect_content_type(image)

    if image.startswith("data:"):
        _, encoded = image.split(",", 1)
        try:
            decoded = base64.b64decode(encoded)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid base64 image data: {str(e)}",
            )
        return decoded, _detect_content_type(image)

    if image.startswith("http://") or image.startswith("https://"):
        try:
            response = requests.get(image, timeout=10)
            response.raise_for_status()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unable to fetch image from URL: {str(exc)}",
            )

        image_bytes = response.content
        content_type = response.headers.get("Content-Type", "")
        content_type = content_type.split(";")[0].strip() if content_type else _detect_content_type(image_bytes)
        return image_bytes, content_type

    try:
        decoded = base64.b64decode(image)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid base64 image data: {str(e)}",
        )

    return decoded, _detect_content_type(image)
 
 
def _get_file_extension(content_type: str) -> str:
    """Get file extension from content type."""
    ext = mimetypes.guess_extension(content_type)
    if not ext:
        ext = ".png"
    return ext


def _save_to_local_storage(image_bytes: bytes, content_type: str, bucket_path: str) -> str:
    """Fallback: save image to local storage when Supabase fails."""
    # Create uploads directory structure
    uploads_dir = "uploads"
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Add extension if missing
    if "." not in bucket_path.split("/")[-1]:
        ext = _get_file_extension(content_type)
        bucket_path = f"{bucket_path}{ext}"
    
    # Add unique ID to prevent collisions
    parts = bucket_path.rsplit("/", 1)
    if len(parts) == 2:
        folder, filename = parts
        name, ext = filename.rsplit(".", 1) if "." in filename else (filename, "png")
        unique_filename = f"{name}_{uuid.uuid4().hex[:8]}.{ext}"
        bucket_path = f"{folder}/{unique_filename}"
    else:
        name, ext = bucket_path.rsplit(".", 1) if "." in bucket_path else (bucket_path, "png")
        bucket_path = f"{name}_{uuid.uuid4().hex[:8]}.{ext}"
    
    # Create full local path
    local_path = os.path.join(uploads_dir, bucket_path)
    local_dir = os.path.dirname(local_path)
    os.makedirs(local_dir, exist_ok=True)
    
    # Write file to disk
    try:
        with open(local_path, "wb") as f:
            f.write(image_bytes)
        logger.info(f"Image saved to local storage: {local_path}")
        # Return a local file URL or path
        return f"file://{os.path.abspath(local_path)}"
    except Exception as e:
        logger.error(f"Failed to save to local storage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save image to local storage: {str(e)}",
        )


_ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
}

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _validate_image_bytes(image_bytes: bytes, content_type: str) -> None:
    """Validate image bytes for size, type, and content."""
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image data is empty.",
        )

    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image exceeds maximum size of {MAX_IMAGE_SIZE_BYTES // 1024 // 1024} MB.",
        )

    actual_type = imghdr.what(None, image_bytes)
    if actual_type == "jpeg":
        actual_content_type = "image/jpeg"
    elif actual_type == "png":
        actual_content_type = "image/png"
    elif actual_type == "gif":
        actual_content_type = "image/gif"
    elif actual_type == "webp":
        actual_content_type = "image/webp"
    else:
        actual_content_type = None

    if actual_content_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported or invalid image format.",
        )

    if actual_content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image type: {actual_content_type}",
        )

    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported declared image MIME type: {content_type}",
        )


def _upload_bytes_to_supabase(image_bytes: bytes, content_type: str, bucket_path: str) -> str:
    """Upload raw image bytes to Supabase, with fallback to local storage on failure."""
    # Try Supabase first
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        try:
            if "." not in bucket_path.split("/")[-1]:
                ext = _get_file_extension(content_type)
                bucket_path = f"{bucket_path}{ext}"

            parts = bucket_path.rsplit("/", 1)
            if len(parts) == 2:
                folder, filename = parts
                name, ext = filename.rsplit(".", 1) if "." in filename else (filename, "png")
                unique_filename = f"{name}_{uuid.uuid4().hex[:8]}.{ext}"
                bucket_path = f"{folder}/{unique_filename}"
            else:
                name, ext = bucket_path.rsplit(".", 1) if "." in bucket_path else (bucket_path, "png")
                bucket_path = f"{name}_{uuid.uuid4().hex[:8]}.{ext}"

            upload_url = f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_STORAGE_BUCKET}/{bucket_path}"

            headers = {
                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                "Content-Type": content_type,
            }

            response = requests.put(upload_url, headers=headers, data=image_bytes, timeout=15)
            if response.status_code in (200, 201):
                logger.info(f"Image uploaded to Supabase: {bucket_path}")
                return (
                    f"{settings.SUPABASE_URL}/storage/v1/object/public/"
                    f"{settings.SUPABASE_STORAGE_BUCKET}/{bucket_path}"
                )
            else:
                logger.warning(f"Supabase upload failed ({response.status_code}), falling back to local storage")
        except Exception as e:
            logger.warning(f"Supabase upload error: {e}. Falling back to local storage")
    else:
        logger.info("Supabase not configured, using local storage")
    
    # Fallback to local storage
    return _save_to_local_storage(image_bytes, content_type, bucket_path)


def upload_images_to_supabase(images: list[Union[str, bytes]], bucket_prefix: str) -> list[str]:
    """Validate and upload a batch of images to Supabase Storage (with local fallback)."""
    if not images:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one image must be provided.",
        )

    uploaded_urls: list[str] = []
    for idx, image in enumerate(images, 1):
        try:
            image_bytes, content_type = _decode_image(image)
            _validate_image_bytes(image_bytes, content_type)

            file_path = f"{bucket_prefix}/{uuid.uuid4().hex}"
            url = _upload_bytes_to_supabase(image_bytes, content_type, file_path)
            uploaded_urls.append(url)
            logger.info(f"Image {idx}/{len(images)} uploaded successfully")
        except Exception as e:
            logger.error(f"Failed to upload image {idx}/{len(images)}: {e}")
            raise

    return uploaded_urls


def upload_image_to_supabase(image: Union[str, bytes], bucket_path: str) -> str:
    """
    Upload an image to Supabase Storage and return the public URL.
 
    Args:
        image: Image data as raw bytes or base64-encoded string
              (with or without data:image/...;base64, prefix).
        bucket_path: Destination path within the bucket,
                     e.g. "designs/user_123/variant_1.png"
                     If no extension is provided, one will be auto-detected.
 
    Returns:
        Public URL of the uploaded image.
 
    Raises:
        HTTPException: If the upload fails.
 
    To switch to AWS S3:
        Replace the implementation of this function with:
            import boto3
            s3 = boto3.client("s3", ...)
            s3.upload_fileobj(...)
            return f"https://{bucket}.s3.amazonaws.com/{key}"
    """
    image_bytes, content_type = _decode_image(image)
    _validate_image_bytes(image_bytes, content_type)
    return _upload_bytes_to_supabase(image_bytes, content_type, bucket_path)
