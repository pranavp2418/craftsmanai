from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.order import ManufacturerQuoteResponse
from app.services.manufacturer_quote_service import ManufacturerQuoteService
from app.models.order import ManufacturerQuoteStatus
from app.models.user import User

router = APIRouter()

@router.put("/{quote_id}/reject", response_model=ManufacturerQuoteResponse)
def reject_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerQuoteService(db)
    quote = service.quote_repo.get_by_id(quote_id)
    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")
    return service.update_status(quote, status=ManufacturerQuoteStatus.REJECTED)
