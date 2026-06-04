from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.customer import CustomerListResponse
from app.services.customer_service import CustomerService
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=CustomerListResponse)
def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Filter by customer status: 'Active' or 'Inactive'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
    items = service.list_customers(
        created_by_user_id=current_user.id,
        offset=skip,
        limit=limit,
        search=search,
        is_active=is_active,
    )
    total = service.customer_repo.count_customers(
        created_by_user_id=current_user.id,
        search=search,
        is_active=is_active,
    )
    page = (skip // limit) + 1
    return CustomerListResponse(items=items, total=total, page=page)

