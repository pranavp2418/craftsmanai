import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.customer import CustomerUpdateRequest, CustomerResponse
from app.services.customer_service import CustomerService
from app.models.user import User

router = APIRouter()

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    request: CustomerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = CustomerService(db)
    customer = service.get_customer(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Security check: verify the customer belongs to the current user
    if customer.created_by_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this customer",
        )
    
    # Validate against current user's email/phone
    user_email = current_user.email.lower().strip() if current_user.email else None
    user_phone = current_user.whatsapp_number.strip() if current_user.whatsapp_number else None
    
    if request.emails:
        for e in request.emails:
            req_email = e.email.lower().strip() if getattr(e, 'email', None) else ""
            if user_email and req_email == user_email:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot use your own email address for a customer.")
                
    if request.phone_number and user_phone and request.phone_number.strip() == user_phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot use your own phone number for a customer.")
        
    # Validate against manufacturers
    from app.models.manufacturer import Manufacturer
    
    # Check phone number
    if request.phone_number:
        manufacturer_with_phone = db.query(Manufacturer).filter(
            Manufacturer.phone_number == request.phone_number.strip(),
            Manufacturer.is_deleted == False
        ).first()
        if manufacturer_with_phone:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This phone number belongs to a manufacturer.")
            
    # Check emails
    if request.emails:
        req_emails = [e.email.lower().strip() for e in request.emails if getattr(e, 'email', None)]
        manufacturers = db.query(Manufacturer).filter(
            Manufacturer.emails.isnot(None),
            Manufacturer.is_deleted == False
        ).all()
        
        for m in manufacturers:
            try:
                m_emails_data = json.loads(m.emails)
                if isinstance(m_emails_data, list):
                    for m_email_obj in m_emails_data:
                        m_email = (m_email_obj.get("email") if isinstance(m_email_obj, dict) else str(m_email_obj)).lower().strip()
                        if m_email in req_emails:
                            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address belongs to a manufacturer.")
                elif isinstance(m_emails_data, dict):
                    m_email = str(m_emails_data.get("email", "")).lower().strip()
                    if m_email in req_emails:
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address belongs to a manufacturer.")
            except (json.JSONDecodeError, TypeError):
                # Fallback
                m_email = str(m.emails).split(',')[0].strip().lower()
                if m_email in req_emails:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address belongs to a manufacturer.")

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
