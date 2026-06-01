from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.manufacturer import ManufacturerListResponse
from app.services.manufacturer_service import ManufacturerService
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=ManufacturerListResponse)
def list_manufacturers(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Filter by manufacturer status: active or inactive"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    normalized_status = status.lower().strip() if status else None
    if normalized_status and normalized_status not in {"active", "inactive"}:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="status must be either 'active' or 'inactive'")

    service = ManufacturerService(db)
    items = service.list_manufacturers(
        created_by_user_id=current_user.id,
        offset=skip,
        limit=limit,
        search=search,
        status=normalized_status,
    )
    total = service.count_manufacturers(
        created_by_user_id=current_user.id,
        search=search,
        status=normalized_status,
    )
    page = (skip // limit) + 1
    return ManufacturerListResponse(items=items, total=total, page=page)

