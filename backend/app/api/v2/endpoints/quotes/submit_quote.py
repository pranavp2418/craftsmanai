from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.order import ManufacturerQuoteSubmitRequest, ManufacturerQuoteResponse
from app.services.manufacturer_quote_service import ManufacturerQuoteService
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=ManufacturerQuoteResponse, status_code=status.HTTP_201_CREATED)
def submit_quote(
    request: ManufacturerQuoteSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerQuoteService(db)
    return service.submit_quote(
        order_id=request.order_id,
        manufacturer_id=request.manufacturer_id,
        cost_price=request.cost_price,
        delivery_time_days=request.delivery_time_days,
        notes=request.notes
    )
