from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any

from app.services.sms_service import sms_service
from app.core.rate_limiter import limiter
from fastapi import Request

router = APIRouter()

class SMSRequest(BaseModel):
    to_number: str
    message: str

@router.post("/test-sms")
@limiter.limit("5/minute")
async def test_sms(request: Request, sms_req: SMSRequest) -> Dict[str, Any]:
    """
    Test endpoint for sending SMS using Twilio.
    """
    if not sms_service.is_configured():
        raise HTTPException(status_code=500, detail="Twilio is not configured.")

    success = sms_service.send_sms(to_number=sms_req.to_number, message=sms_req.message)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send SMS")

    return {"status": "success", "message": "SMS sent successfully"}
