import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.customer import CustomerUpdateRequest, CustomerResponse
from app.services.customer_service import CustomerService
from app.models.user import User

router = APIRouter()

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    request: CustomerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = CustomerService(db)
    customer = service.get_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    update_data = {}
    if request.full_name is not None:
        update_data["full_name"] = request.full_name
    if request.tag is not None:
        update_data["tag"] = request.tag
    if request.phone_number is not None:
        update_data["phone_number"] = request.phone_number
    if request.location is not None:
        update_data["location"] = request.location
    if request.status is not None:
        update_data["is_active"] = (request.status.strip().capitalize() == "Active")
    if request.emails is not None:
        update_data["emails"] = json.dumps([e.model_dump() for e in request.emails])
        
    return service.update_customer(customer, **update_data)
