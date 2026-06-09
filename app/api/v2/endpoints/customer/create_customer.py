import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_active_user
from app.schemas.customer import CustomerCreateRequest, CustomerResponse
from app.services.customer_service import CustomerService
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    request: CustomerCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = CustomerService(db)
    
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
    from sqlalchemy import or_
    import json
    
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

    # Validate against existing customers
    from app.models.customer import Customer
    
    if request.phone_number:
        customer_with_phone = db.query(Customer).filter(
            Customer.phone_number == request.phone_number.strip(),
            Customer.is_deleted == False
        ).first()
        if customer_with_phone:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This phone number already belongs to a customer.")
            
    if request.emails:
        req_emails = [e.email.lower().strip() for e in request.emails if getattr(e, 'email', None)]
        customers = db.query(Customer).filter(
            Customer.emails.isnot(None),
            Customer.is_deleted == False
        ).all()
        
        for c in customers:
            try:
                c_emails_data = json.loads(c.emails)
                if isinstance(c_emails_data, list):
                    for c_email_obj in c_emails_data:
                        c_email = (c_email_obj.get("email") if isinstance(c_email_obj, dict) else str(c_email_obj)).lower().strip()
                        if c_email in req_emails:
                            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address already belongs to a customer.")
                elif isinstance(c_emails_data, dict):
                    c_email = str(c_emails_data.get("email", "")).lower().strip()
                    if c_email in req_emails:
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address already belongs to a customer.")
            except (json.JSONDecodeError, TypeError):
                c_email = str(c.emails).split(',')[0].strip().lower()
                if c_email in req_emails:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address already belongs to a customer.")

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
