from __future__ import annotations

from typing import Optional
from uuid import uuid4
import os

from fastapi import UploadFile

from app.core.config import settings
from app.services.storage_service import upload_image_to_supabase


def _local_save(file: UploadFile, dest_folder: str) -> str:
    os.makedirs(dest_folder, exist_ok=True)
    filename = f"{uuid4().hex}_{file.filename}"
    path = os.path.join(dest_folder, filename)
    with open(path, "wb") as f:
        f.write(file.file.read())
    # return a relative path the app can serve or reference
    return path


def upload_additional_note_image(file: UploadFile) -> Optional[str]:
    """Upload the provided file to Supabase storage under craftsman/additional_notes.

    Returns a public URL (or local path fallback) or None on failure.
    """
    # Prefer Supabase storage when configured, using the same REST-based uploader
    # that already works elsewhere in the codebase.
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        try:
            file.file.seek(0)
            data = file.file.read()
            dest_path = f"craftsman/additional_notes/{uuid4().hex}_{file.filename or 'note_image'}"
            return upload_image_to_supabase(data, dest_path)
        except Exception:
            # fallback to local save
            pass

    # Fallback: save locally to `uploads/additional_notes/`
    uploads_dir = os.path.join(os.getcwd(), "uploads", "additional_notes")
    return _local_save(file, uploads_dir)
