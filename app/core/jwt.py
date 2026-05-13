from datetime import datetime
import jwt
from app.core.config import settings

def create_access_token(user_id: int) -> tuple[str, str, datetime]:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + datetime.timedelta(hours=24),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    jti = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]).get("jti")
    expires_at = payload["exp"]
    return token, jti, expires_at  # Ensure tuple return

def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + datetime.timedelta(hours=7),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    jti = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]).get("jti")
    expires_at = payload["exp"]
    return token, jti, expires_at  # Ensure tuple return