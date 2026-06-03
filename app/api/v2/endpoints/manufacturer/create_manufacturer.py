import json
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
    
    # Serialize emails list to JSON string
    emails_str = None
    if request.emails:
        emails_str = json.dumps([e.model_dump() for e in request.emails])
        
    return service.create_manufacturer(
        created_by_user_id=current_user.id,
        name=request.name,
        speciality=request.speciality.value if request.speciality else None,
        emails=emails_str,
        phone_number=request.phone_number,
        location=request.location,
        is_active=request.is_active if request.is_active is not None else True,
    )
