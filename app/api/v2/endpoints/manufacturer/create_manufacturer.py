from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.manufacturer import ManufacturerCreateRequest, ManufacturerResponse
from app.services.manufacturer_service import ManufacturerService
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=ManufacturerResponse, status_code=status.HTTP_201_CREATED)
def create_manufacturer(
    request: ManufacturerCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerService(db)
    return service.create_manufacturer(current_user.id, request)
