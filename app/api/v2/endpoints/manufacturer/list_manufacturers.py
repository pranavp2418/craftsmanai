from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.manufacturer import ManufacturerListResponse
from app.services.manufacturer_service import ManufacturerService
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=ManufacturerListResponse)
def list_manufacturers(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Number of records per page"),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Filter by manufacturer status: active or inactive"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    normalized_status = status.lower().strip() if status else None
    if normalized_status and normalized_status not in {"active", "inactive"}:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="status must be either 'active' or 'inactive'")

    service = ManufacturerService(db)
    offset = (page - 1) * limit
    items = service.list_manufacturers(
        created_by_user_id=current_user.id,
        offset=offset,
        limit=limit,
        search=search,
        status=normalized_status,
    )
    total = service.count_manufacturers(
        created_by_user_id=current_user.id,
        search=search,
        status=normalized_status,
    )
    total_pages = ceil(total / limit) if limit > 0 else 1
    return ManufacturerListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )