from __future__ import annotations

import mimetypes
from pathlib import Path
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService


router = APIRouter()


class DownloadRenderRequest(BaseModel):
    variant_id: int = Field(..., ge=1, description="ID of the design variant to download")


def _guess_content_type(filename: str, fallback: str = "application/octet-stream") -> str:
    content_type, _ = mimetypes.guess_type(filename)
    return content_type or fallback


def _load_image_bytes(image_url: str) -> tuple[bytes, str, str]:
    parsed = urlparse(image_url)

    if parsed.scheme in {"http", "https"}:
        try:
            response = requests.get(image_url, timeout=20)
            response.raise_for_status()
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unable to download render image: {exc}",
            )

        content_type = response.headers.get("Content-Type", "application/octet-stream").split(";")[0].strip()
        filename = Path(parsed.path).name or "render"
        return response.content, content_type, filename

    if parsed.scheme == "file":
        file_path = Path(parsed.path)
    else:
        file_path = Path(image_url)

    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Render image file not found",
        )

    content = file_path.read_bytes()
    filename = file_path.name or "render"
    return content, _guess_content_type(filename), filename


@router.post("/download-render")
def download_render(
    payload: DownloadRenderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    variant_service = DesignVariantService(db)
    design_service = DesignService(db)

    variant = variant_service.get_variant(payload.variant_id)
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    design = variant.design or design_service.get_design(variant.design_id)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    if design.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not allowed to download this render")

    if not variant.base_design_image_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Render image not available")

    content, content_type, filename = _load_image_bytes(variant.base_design_image_url)
    attachment_name = f"{design.design_code}_variant_{variant.id}_{filename}"

    return Response(
        content=content,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{attachment_name}"'},
    )
