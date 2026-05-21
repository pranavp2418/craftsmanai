from pydantic import BaseModel, Field, EmailStr
from typing import Optional


class UserProfileResponse(BaseModel):
    id: int
    email: EmailStr
    username: str
    first_name: str
    last_name: str
    full_name: Optional[str] = None
    whatsapp_number: Optional[str] = None
    is_active: bool
    is_verified: bool
    is_superuser: bool
    role: str

    class Config:
        orm_mode = True
        from_attributes = True


class UserProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    whatsapp_number: Optional[str] = Field(None, max_length=20)
    username: Optional[str] = Field(None, max_length=100)
