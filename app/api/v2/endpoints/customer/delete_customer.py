from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.customer import CustomerResponse
from app.services.customer_service import CustomerService
from app.models.user import User

router = APIRouter()


@router.delete("/{customer_id}", response_model=CustomerResponse)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = CustomerService(db)
    customer = service.get_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    return service.delete_customer(customer)
