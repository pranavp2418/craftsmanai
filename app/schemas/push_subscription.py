from typing import Optional
from pydantic import BaseModel


class PushSubscriptionRegister(BaseModel):
    """Request body for registering a push subscription from the browser."""
    endpoint: str
    p256dh: str
    auth: str
    device_type: Optional[str] = None
    user_agent: Optional[str] = None


class PushSubscriptionResponse(BaseModel):
    """Response for a push subscription."""
    id: int
    user_id: int
    device_type: Optional[str] = None
    is_active: bool
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class PushVapidKeyResponse(BaseModel):
    """Response containing the VAPID public key for the frontend."""
    public_key: str