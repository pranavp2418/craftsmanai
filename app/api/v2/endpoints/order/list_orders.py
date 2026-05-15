from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.order import OrderListResponse
from app.services.order_service import OrderService
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=OrderListResponse)
def list_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = OrderService(db)
    items, total = service.list_orders(current_user.id, skip, limit)
    return OrderListResponse(items=items, total=total)
