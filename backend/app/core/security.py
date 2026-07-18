from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt, ExpiredSignatureError
import hashlib
import secrets
import string
import uuid
from .config import settings
from app.core.timezone import now as tz_now


def get_password_hash(password: str) -> str:
    """
    Hash a password using SHA-256 with salt.
    """
    # Generate a random salt
    salt = secrets.token_hex(16)
    
    # Combine password and salt
    salted_password = password + salt
    
    # Hash with SHA-256
    hashed = hashlib.sha256(salted_password.encode('utf-8')).hexdigest()
    
    # Return salt + hash (store salt with hash)
    return f"{salt}${hashed}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its SHA-256 hash.
    """
    try:
        # Extract salt and hash
        salt, stored_hash = hashed_password.split('$')
        
        # Hash the provided password with the same salt
        salted_password = plain_password + salt
        computed_hash = hashlib.sha256(salted_password.encode('utf-8')).hexdigest()
        
        # Compare hashes
        return computed_hash == stored_hash
    except ValueError:
        # Invalid hash format
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = tz_now() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    to_encode.update({
        "exp": expire,
        "iat": tz_now(),
        "jti": str(uuid.uuid4()),
        "type": "access"
    })
    
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: str, remember_me: bool = False):
    token_id = str(uuid.uuid4())

    expires_delta = timedelta(
        days=settings.REFRESH_TOKEN_DAYS_REMEMBER
        if remember_me
        else settings.REFRESH_TOKEN_DAYS
    )

    expire = tz_now() + expires_delta

    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": tz_now(),
        "jti": token_id,
        "type": "refresh"
    }

    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return token, token_id, expire


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        # Enable expiration validation by NOT disabling verify_exp
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True}  # Explicitly enable expiration validation
        )

        if payload.get("type") != "access":
            return None

        # Check if token is blacklisted
        jti = payload.get("jti")
        if jti:
            from app.core.token_blacklist import token_blacklist
            if token_blacklist.is_access_token_blacklisted(jti):
                logger.warning(f"Access token is blacklisted: {jti}")
                return None

        return payload

    except ExpiredSignatureError as e:
        # Re-raise with a specific exception type that can be caught and converted to 401
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except JWTError as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"JWT decode error: {str(e)}, token_length={len(token)}")
        return None


def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        # Enable expiration validation for refresh tokens
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True}  # Explicitly enable expiration validation
        )

        if payload.get("type") != "refresh":
            return None

        # Check if token is blacklisted
        jti = payload.get("jti")
        if jti:
            from app.core.token_blacklist import token_blacklist
            if token_blacklist.is_refresh_token_blacklisted(jti):
                logger.warning(f"Refresh token is blacklisted: {jti}")
                return None

        return payload

    except ExpiredSignatureError:
        raise
    except JWTError:
        return None


def generate_otp() -> str:
    # return "123456"
    return ''.join(secrets.choice(string.digits) for _ in range(6))


def generate_token_id() -> str:
    return str(uuid.uuid4())


def is_token_expired(exp: int) -> bool:
    return tz_now().timestamp() > exp


def hash_token(token: str) -> str:
    """Hash a token using SHA-256 (no truncation)"""
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()


def verify_token(token: str, hashed_token: str) -> bool:
    """Verify a token against its SHA-256 hash using constant-time comparison to prevent timing attacks"""
    import hmac
    return hmac.compare_digest(hash_token(token), hashed_token)


def create_reset_token(email: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a temporary JWT token for password reset verification
    """
    to_encode = {
        "sub": email,
        "type": "reset",
        "exp": tz_now() + (expires_delta or timedelta(minutes=15)),
        "iat": tz_now(),
        "jti": str(uuid.uuid4())
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_reset_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a password reset JWT
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True}  # Enable expiration validation
        )
        if payload.get("type") != "reset":
            return None
        return payload
    except JWTError:
        return None