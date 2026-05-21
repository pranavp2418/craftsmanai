from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.manufacturer import ManufacturerResponse
from app.services.manufacturer_service import ManufacturerService
from app.models.user import User

router = APIRouter()


@router.delete("/{manufacturer_id}", response_model=ManufacturerResponse)
def delete_manufacturer(
    manufacturer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerService(db)
    manufacturer = service.get_manufacturer(manufacturer_id)
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
        
    return service.delete_manufacturer(manufacturer)
