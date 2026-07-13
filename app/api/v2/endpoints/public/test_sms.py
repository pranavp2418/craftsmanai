from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any

from app.services.sms_service import sms_service, SMSPermanentError
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

    try:
        success = sms_service.send_sms(to_number=sms_req.to_number, message=sms_req.message)
    except SMSPermanentError as e:
        # Twilio rejected the message permanently (e.g. 21408 = region not enabled in Geo Permissions,
        # 30007 = carrier violation from an unverified sender). Surface the REAL code so it is obvious
        # this must be fixed in the Twilio console — retrying it can never help.
        raise HTTPException(status_code=400, detail=f"Twilio rejected the message — {e}")

    if not success:
        raise HTTPException(status_code=502, detail="Failed to send SMS (transient Twilio error — see logs)")

    return {"status": "success", "message": "SMS sent successfully"}
