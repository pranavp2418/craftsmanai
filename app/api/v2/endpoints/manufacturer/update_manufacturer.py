import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.manufacturer import ManufacturerUpdateRequest, ManufacturerResponse
from app.services.manufacturer_service import ManufacturerService
from app.models.user import User

router = APIRouter()


@router.put("/{manufacturer_id}", response_model=ManufacturerResponse)
def update_manufacturer(
    manufacturer_id: int,
    request: ManufacturerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerService(db)
    manufacturer = service.get_manufacturer(manufacturer_id)
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")

    update_data = {}
    if request.name is not None:
        update_data["name"] = request.name
    if request.speciality is not None:
        update_data["speciality"] = request.speciality.value if request.speciality else None
    if request.phone_number is not None:
        update_data["phone_number"] = request.phone_number
    if request.location is not None:
        update_data["location"] = request.location
    if request.is_active is not None:
        update_data["is_active"] = request.is_active
    if request.emails is not None:
        update_data["emails"] = json.dumps([e.model_dump() for e in request.emails])

    return service.update_manufacturer(manufacturer, **update_data)
