from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.dependencies import get_db, get_current_user
from app.core.device_fingerprint import get_device_info_from_request
from app.models.user import User
from app.models.user_device import UserDevice
from app.models.refresh_token import RefreshToken
from sqlalchemy import func
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/sessions", status_code=status.HTTP_200_OK)
def get_active_sessions(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request
):
    """
    Get all active devices for the currently logged-in user.
    Shows device details and number of active sessions per device.
    """
    # Detect current device from request
    current_device = get_device_info_from_request(request)
    current_device_id = current_device.device_id if current_device else None
    
    # Get all active devices for this user
    devices = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.is_active == True
    ).all()
    
    result = []
    for device in devices:
        # Count active (non-revoked) sessions for this device
        sessions_count = db.query(func.count(RefreshToken.id)).filter(
            RefreshToken.user_id == current_user.id,
            RefreshToken.device_id == device.device_id,
            RefreshToken.is_active == True,
            RefreshToken.expires_at > func.now()
        ).scalar() or 0
        
        # Extract OS and browser from user_agent
        device_os = "unknown"
        browser = "unknown"
        if device.user_agent:
            ua = device.user_agent.lower()
            if "windows" in ua: device_os = "Windows"
            elif "mac os" in ua or "macintosh" in ua: device_os = "macOS"
            elif "linux" in ua and "android" not in ua: device_os = "Linux"
            elif "android" in ua: device_os = "Android"
            elif "iphone" in ua or "ipad" in ua: device_os = "iOS"
            
            if "chrome" in ua and "edg" not in ua and "opr" not in ua: browser = "Chrome"
            elif "firefox" in ua: browser = "Firefox"
            elif "safari" in ua and "chrome" not in ua: browser = "Safari"
            elif "edg" in ua: browser = "Edge"
            elif "opr" in ua or "opera" in ua: browser = "Opera"
        
        result.append({
            "id": device.id,
            "device_id": device.device_id,
            "device_type": device.device_type or "unknown",
            "device_os": device_os,
            "browser": browser,
            "ip_address": device.ip_address,
            "is_current_device": device.device_id == current_device_id,
            "is_active": device.is_active,
            "sessions_count": sessions_count,
            "created_at": device.created_at,
            "last_used": device.last_used
        })
    
    # Sort: current device first, then by last_used desc
    result.sort(key=lambda d: (not d["is_current_device"], d.get("last_used") or ""), reverse=False)
    
    return result