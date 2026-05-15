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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerService(db)
    items, total = service.list_manufacturers(current_user.id, skip, limit)
    return ManufacturerListResponse(items=items, total=total)
