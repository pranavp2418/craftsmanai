from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.customer import CustomerCreateRequest, CustomerResponse
from app.services.customer_service import CustomerService
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    request: CustomerCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = CustomerService(db)
    return service.create_customer(current_user.id, request)
