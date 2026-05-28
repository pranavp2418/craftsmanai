import hashlib
from fastapi import Request
from app.schemas.auth import DeviceInfo
import logging

logger = logging.getLogger(__name__)


def get_device_info_from_request(request: Request) -> DeviceInfo:
    """
    Auto-detect device info from request headers only.
    Generates a unique device_id from User-Agent + IP fingerprint.
    No frontend changes required.
    """
    user_agent = request.headers.get("user-agent", "unknown")
    client_ip = request.client.host if request.client else "unknown"

    # Generate unique device ID from User-Agent + IP fingerprint
    fingerprint = f"{user_agent}|{client_ip}"
    device_id = hashlib.sha256(fingerprint.encode()).hexdigest()[:32]

    # Determine OS
    device_os = "unknown"
    ua_lower = user_agent.lower()
    if "windows" in ua_lower:
        device_os = "Windows"
    elif "mac os" in ua_lower or "macintosh" in ua_lower:
        device_os = "macOS"
    elif "linux" in ua_lower and "android" not in ua_lower:
        device_os = "Linux"
    elif "android" in ua_lower:
        device_os = "Android"
    elif "iphone" in ua_lower or "ipad" in ua_lower or "ios" in ua_lower:
        device_os = "iOS"

    # Determine device type
    device_type = "desktop"
    if "mobile" in ua_lower or ("android" in ua_lower and "mobile" in ua_lower):
        device_type = "mobile"
    elif "ipad" in ua_lower or "tablet" in ua_lower:
        device_type = "tablet"

    # Determine browser
    browser = "unknown"
    if "chrome" in ua_lower and "edg" not in ua_lower and "opr" not in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower and "chrome" not in ua_lower:
        browser = "Safari"
    elif "edg" in ua_lower:
        browser = "Edge"
    elif "opr" in ua_lower or "opera" in ua_lower:
        browser = "Opera"

    device_info = DeviceInfo(
        device_id=device_id,
        device_type=device_type,
        device_os=device_os,
        browser=browser,
        ip_address=client_ip,
        user_agent=user_agent
    )

    logger.debug(f"Auto-detected device: {device_info.model_dump()}")
    return device_info