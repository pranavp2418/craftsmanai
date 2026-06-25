from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.customer import CustomerListResponse
from app.services.customer_service import CustomerService
from app.models.user import User


router = APIRouter()

@router.get("/", response_model=CustomerListResponse)
def list_customers(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Number of records per page"),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Filter by customer status: 'Active' or 'Inactive'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Map status string to is_active boolean
    is_active = None
    if status:
        status_lower = status.lower()
        if status_lower == "active":
            is_active = True
        elif status_lower == "inactive":
            is_active = False

    service = CustomerService(db)
    offset = (page - 1) * limit
    items = service.list_customers(
        created_by_user_id=current_user.id,
        offset=offset,
        limit=limit,
        search=search,
        is_active=is_active,
    )
    total = service.customer_repo.count_customers(
        created_by_user_id=current_user.id,
        search=search,
        is_active=is_active,
    )
    total_pages = ceil(total / limit) if limit > 0 else 1
    return CustomerListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
        has_next=page < total_pages,
        has_prev=page > 1,
    )