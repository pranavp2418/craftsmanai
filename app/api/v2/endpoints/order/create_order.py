from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.order import OrderCreateRequest, OrderCreateResponse, OrderResponse
from app.services.order_service import OrderService
from app.models.user import User

router = APIRouter()


@router.post("/", response_model=OrderCreateResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    request: OrderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create an order from a selected design variant.

    Only ``design_variant_id`` and ``customer_id`` are required.
    The ``share_id`` and ``design_id`` are resolved automatically.
    """
    service = OrderService(db)
    order, share_id = service.create_order(
        design_variant_id=request.design_variant_id,
        customer_id=request.customer_id,
    )
    return OrderCreateResponse(
        order=OrderResponse.model_validate(order),
        share_id=share_id,
        design_id=order.design_id,
    )
