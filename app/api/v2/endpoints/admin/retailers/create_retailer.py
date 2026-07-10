from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.models.user import User
from app.core.security import get_password_hash
from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid
from app.core.timezone import now as tz_now

router = APIRouter()

class AdminRetailerCreate(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None
    password: str
    status: Optional[str] = "ACTIVE"

@router.post("/retailers")
async def create_retailer(
    retailer_in: AdminRetailerCreate,
    db: AsyncSession = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    check_res = await db.execute(select(User).where(User.email == retailer_in.email))
    if check_res.scalars().first():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    # retailer phone no. check
    if retailer_in.phone:
        phone_res = await db.execute(select(User).where(User.whatsapp_number == retailer_in.phone))
        if phone_res.scalars().first():
            raise HTTPException(status_code=400, detail="Retailer with this phone number already exists")
        
    year = tz_now().year
    random_part = uuid.uuid4().hex[:4].upper()
    identifier = f"RET-{year}-{random_part}"
    
    # Status handling: default to ACTIVE, map 'inactive'/'disabled' to False for is_active
    is_active_val = True
    if retailer_in.status:
        input_status = retailer_in.status.upper()
        if input_status in ["INACTIVE", "DISABLED"]:
            is_active_val = False
    
    new_retailer = User(
        email=retailer_in.email,
        username=identifier,
        full_name=retailer_in.name,
        whatsapp_number=retailer_in.phone,
        hashed_password=get_password_hash(retailer_in.password),
        is_superuser=False,
        is_active=is_active_val
    )
    db.add(new_retailer)
    await db.commit()
    
    return {
        "message": "Retailer created successfully",
        "retailer_id": new_retailer.id
    }
