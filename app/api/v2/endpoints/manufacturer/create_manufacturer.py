import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.schemas.manufacturer import ManufacturerCreateRequest, ManufacturerResponse
from app.services.manufacturer_service import ManufacturerService
from app.models.user import User

router = APIRouter()


@router.post("/", response_model=ManufacturerResponse, status_code=status.HTTP_201_CREATED)
def create_manufacturer(
    request: ManufacturerCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ManufacturerService(db)
    
    # Validate against current user's email/phone
    user_email = current_user.email.lower().strip() if current_user.email else None
    user_phone = current_user.whatsapp_number.strip() if current_user.whatsapp_number else None
    
    if request.emails:
        for e in request.emails:
            req_email = e.email.lower().strip() if getattr(e, 'email', None) else ""
            if user_email and req_email == user_email:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot use your own email address for a manufacturer.")
                
    if request.phone_number and user_phone and request.phone_number.strip() == user_phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot use your own phone number for a manufacturer.")

    # Validate against customers
    from app.models.customer import Customer
    import json
    
    if request.phone_number:
        customer_with_phone = db.query(Customer).filter(
            Customer.phone_number == request.phone_number.strip(),
            Customer.is_deleted == False
        ).first()
        if customer_with_phone:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This phone number belongs to a customer.")
            
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
                            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address belongs to a customer.")
                elif isinstance(c_emails_data, dict):
                    c_email = str(c_emails_data.get("email", "")).lower().strip()
                    if c_email in req_emails:
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address belongs to a customer.")
            except (json.JSONDecodeError, TypeError):
                c_email = str(c.emails).split(',')[0].strip().lower()
                if c_email in req_emails:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address belongs to a customer.")

    # Validate against existing manufacturers
    from app.models.manufacturer import Manufacturer
    
    if request.phone_number:
        manufacturer_with_phone = db.query(Manufacturer).filter(
            Manufacturer.phone_number == request.phone_number.strip(),
            Manufacturer.is_deleted == False
        ).first()
        if manufacturer_with_phone:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This phone number already belongs to a manufacturer.")
            
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
                            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address already belongs to a manufacturer.")
                elif isinstance(m_emails_data, dict):
                    m_email = str(m_emails_data.get("email", "")).lower().strip()
                    if m_email in req_emails:
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address already belongs to a manufacturer.")
            except (json.JSONDecodeError, TypeError):
                m_email = str(m.emails).split(',')[0].strip().lower()
                if m_email in req_emails:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This email address already belongs to a manufacturer.")

    # Serialize emails list to JSON string
    emails_str = None
    if request.emails:
        emails_str = json.dumps([e.model_dump() for e in request.emails])
        
    return service.create_manufacturer(
        created_by_user_id=current_user.id,
        name=request.name,
        speciality=request.speciality.value if request.speciality else None,
        emails=emails_str,
        phone_number=request.phone_number,
        location=request.location,
        is_active=request.is_active if request.is_active is not None else True,
    )
