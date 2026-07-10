"""
JWT utility functions for token creation and validation.

Uses python-jose (matching app/core/security.py) for JWT operations.
"""
from datetime import datetime, timedelta
from app.core.timezone import now as tz_now
from typing import Optional, Tuple
from jose import JWTError, jwt
from app.core.config import settings


def create_access_token(user_id: int) -> Tuple[str, str, datetime]:
    """Create a JWT access token with standard claims (sub, email, username)."""
    now = tz_now()
    token_id = f"jti_{user_id}_{int(now.timestamp())}"
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": token_id,
        "type": "access",
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    expires_at = payload["exp"]
    return token, token_id, expires_at


def create_refresh_token(user_id: int) -> Tuple[str, str, datetime]:
    """Create a JWT refresh token."""
    now = tz_now()
    token_id = f"jti_ref_{user_id}_{int(now.timestamp())}"
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=settings.REFRESH_TOKEN_DAYS),
        "jti": token_id,
        "type": "refresh",
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    expires_at = payload["exp"]
    return token, token_id, expires_at


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT access token.

    Args:
        token: The JWT string.

    Returns:
        The decoded payload dict if valid, None otherwise.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True},
        )
        return payload
    except JWTError:
        return None