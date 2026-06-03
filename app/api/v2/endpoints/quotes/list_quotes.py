from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.order import ManufacturerQuoteListResponse
from app.services.manufacturer_quote_service import ManufacturerQuoteService
from app.models.user import User

router = APIRouter()

@router.get("/order/{order_id}", response_model=ManufacturerQuoteListResponse)
def list_quotes(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerQuoteService(db)
    items = service.list_quotes(order_id)
    return ManufacturerQuoteListResponse(items=items)

from app.schemas.order import ManufacturerQuoteDetailListResponse

@router.get("/order/{order_id}/details", response_model=ManufacturerQuoteDetailListResponse)
def list_quotes_with_details(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerQuoteService(db)
    items = service.list_quotes_with_details(order_id)
    return ManufacturerQuoteDetailListResponse(items=items)
