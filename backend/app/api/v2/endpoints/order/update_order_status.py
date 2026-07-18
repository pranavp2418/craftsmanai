from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.order import OrderStatusUpdateRequest, OrderResponse
from app.services.order_service import OrderService
from app.models.user import User

router = APIRouter()

@router.put("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    request: OrderStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = OrderService(db)
    order = service.get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return service.update_status(
        order,
        status=request.status,
        message=request.message,
    )
