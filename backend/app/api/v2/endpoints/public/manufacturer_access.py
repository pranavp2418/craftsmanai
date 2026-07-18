from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.public import PublicManufacturerAccessResponse
from app.models.manufacturer import Manufacturer
from app.repositories.manufacturer import ManufacturerRepository

router = APIRouter()


@router.post("/manufacturer/access", response_model=PublicManufacturerAccessResponse)
def manufacturer_access(
    token: str,
    db: Session = Depends(get_db),
):
    """Public endpoint for manufacturers to access their profile via token."""
    repo = ManufacturerRepository(db)
    manufacturer = repo.get_by_token(token)
    if not manufacturer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired manufacturer token",
        )

    return PublicManufacturerAccessResponse(
        id=manufacturer.id,
        name=manufacturer.name,
        company_name=manufacturer.company_name,
        email=manufacturer.email,
        phone=manufacturer.phone,
        location=manufacturer.location,
    )