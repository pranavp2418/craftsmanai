import json
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
    current_user: User = Depends(get_current_user),
):
    service = CustomerService(db)
    
    # Serialize the list of emails into a JSON string for the DB column
    email_db = None
    if request.emails:
        email_db = json.dumps([e.model_dump() for e in request.emails])
        
    # Translate status string to a boolean
    is_active_db = True
    if request.status:
        is_active_db = (request.status.strip().capitalize() == "Active")
        
    return service.create_customer(
        created_by_user_id=current_user.id,
        full_name=request.full_name,
        emails=email_db,
        phone_number=request.phone_number,
        tag=request.tag,
        location=request.location,
        is_active=is_active_db,
    )
