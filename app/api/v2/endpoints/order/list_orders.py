from math import ceil
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.order import OrderListResponse
from app.services.order_service import OrderService
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=OrderListResponse)
def list_orders(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Number of records per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = OrderService(db)
    offset = (page - 1) * limit
    items = service.list_orders(limit=limit, offset=offset)
    total = service.order_repo.count_orders()
    total_pages = ceil(total / limit) if limit > 0 else 1
    return OrderListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )