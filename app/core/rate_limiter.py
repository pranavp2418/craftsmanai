import redis
import json
import time
import os
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Lazy Redis connection for rate limiting
_redis_client = None

def get_redis_client():
    """Lazy load Redis client - skip in test/development mode"""
    global _redis_client
    
    # In test or development mode, don't connect to Redis
    if os.environ.get("TESTING") == "true" or settings.ENV in {"test", "development"}:
        return None
    
    if _redis_client is None:
        try:
            _redis_client = redis.Redis.from_url(settings.CELERY_BROKER_URL, decode_responses=True)
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            return None
    return _redis_client

redis_client = None  # Will be loaded lazily

class DummyLimiter:
    def limit(self, *args, **kwargs):
        def decorator(func):
            return func
        return decorator
    def exempt(self, func):
        return func

# Create limiter only if not in test mode
try:
    if os.environ.get("TESTING") != "true" and settings.ENV != "test":
        limiter = Limiter(
            key_func=get_remote_address,
            storage_uri=settings.CELERY_BROKER_URL,
            default_limits=[settings.RATE_LIMIT_GLOBAL]
        )
    else:
        limiter = DummyLimiter()
except Exception as e:
    logger.warning(f"Failed to create Limiter: {e}")
    limiter = DummyLimiter()



class RateLimiter:
    def __init__(self):
        self.redis = None  # Will be loaded lazily

    def get_redis(self):
        """Get Redis client, lazily loading if needed"""
        if os.environ.get("TESTING") == "true" or settings.ENV in {"test", "development"}:
            return None
        
        if self.redis is None:
            self.redis = get_redis_client()
        return self.redis

    def is_allowed(self, key: str, limit: str, window: int) -> tuple[bool, Dict[str, Any]]:
        """
        Check if request is allowed based on rate limit
        
        Args:
            key: Redis key for rate limiting
            limit: Maximum requests allowed
            window: Time window in seconds
            
        Returns:
            tuple of (is_allowed, info_dict)
        """
        # Skip rate limiting in test/development mode
        if os.environ.get("TESTING") == "true" or settings.ENV in {"test", "development"}:
            return True, {
                "limit": limit,
                "remaining": limit,
                "reset": int(time.time()) + window,
                "retry_after": 0
            }
        
        redis = self.get_redis()
        if redis is None:
            # If Redis is unavailable, allow the request
            return True, {
                "limit": limit,
                "remaining": limit,
                "reset": int(time.time()) + window,
                "retry_after": 0
            }
        
        try:
            current_time = int(time.time())
            window_start = current_time - window
            
            # Remove old entries
            redis.zremrangebyscore(key, 0, window_start)
            
            # Count current requests
            current_requests = redis.zcard(key)
            
            if current_requests >= limit:
                # Get oldest request time for retry-after
                oldest = redis.zrange(key, 0, 0, withscores=True)
                retry_after = 0
                if oldest:
                    retry_after = int(oldest[0][1] + window - current_time)
                
                return False, {
                    "limit": limit,
                    "remaining": 0,
                    "reset": current_time + window,
                    "retry_after": max(retry_after, 1)
                }
            
            # Add current request
            redis.zadd(key, {str(current_time): current_time})
            redis.expire(key, window)
            
            remaining = limit - current_requests - 1
            
            return True, {
                "limit": limit,
                "remaining": remaining,
                "reset": current_time + window,
                "retry_after": 0
            }
            
        except Exception as e:
            logger.error(f"Rate limiter error: {str(e)}")
            # Allow request if rate limiter fails
            return True, {"limit": limit, "remaining": 1, "reset": 0, "retry_after": 0}

    def parse_rate_limit(self, rate_limit_str: str) -> tuple[int, int]:
        """
        Parse rate limit string like "5/minute" or "60/hour"
        
        Returns:
            tuple of (limit, window_seconds)
        """
        try:
            parts = rate_limit_str.split('/')
            limit = int(parts[0])
            period = parts[1].lower()
            
            if period.startswith('second'):
                window = 1
            elif period.startswith('minute'):
                window = 60
            elif period.startswith('hour'):
                window = 3600
            elif period.startswith('day'):
                window = 86400
            else:
                window = 60  # Default to minute
                
            return limit, window
            
        except Exception as e:
            logger.error(f"Error parsing rate limit '{rate_limit_str}': {str(e)}")
            return 60, 60  # Default: 60 requests per minute

    def check_rate_limit(self, *args, **kwargs):
        # Bypass rate limiting in development/test environments
        if os.environ.get("TESTING") == "true" or os.environ.get("ENV") == "development" or settings.ENV in {"development", "test"}:
            return  # Skip rate limiting in tests
        
        rate_limit_str = kwargs.get("rate_limit_str")
        if rate_limit_str is None and len(args) > 1:
            rate_limit_str = args[1]
        limit, window = self.parse_rate_limit(rate_limit_str or "5/minute")
        allowed, info = self.is_allowed(args[0], limit, window)
        
        if not allowed:
            logger.warning(f"Rate limit exceeded for key: {args[0]}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={
                    "X-RateLimit-Limit": str(info["limit"]),
                    "X-RateLimit-Remaining": str(info["remaining"]),
                    "X-RateLimit-Reset": str(info["reset"]),
                    "Retry-After": str(info["retry_after"])
                }
            )
        
        return True

    def is_rate_limited(self, *args, **kwargs):
        # Bypass rate limiting in development/test environments
        if os.environ.get("TESTING") == "true" or os.environ.get("ENV") == "development" or settings.ENV in {"development", "test"}:
            return False  # Never rate limited in tests
        
        rate_limit_str = kwargs.get("rate_limit_str")
        if rate_limit_str is None and len(args) > 1:
            rate_limit_str = args[1]
        limit, window = self.parse_rate_limit(rate_limit_str or "5/minute")
        allowed, info = self.is_allowed(args[0], limit, window)
        
        return not allowed

    def get_rate_limit_headers(self, key: str, rate_limit_str: str) -> Dict[str, str]:
        """
        Get rate limit headers for response
        
        Args:
            key: Redis key for rate limiting
            rate_limit_str: Rate limit string like "5/minute"
            
        Returns:
            Dictionary of rate limit headers
        """
        limit, window = self.parse_rate_limit(rate_limit_str)
        _, info = self.is_allowed(key, limit, window)
        
        return {
            "X-RateLimit-Limit": str(info["limit"]),
            "X-RateLimit-Remaining": str(info["remaining"]),
            "X-RateLimit-Reset": str(info["reset"])
        }


# Global rate limiter instance
rate_limiter = RateLimiter()


def get_rate_limit_key(request: Request, identifier: str = "") -> str:
    """
    Generate rate limit key based on request
    
    Args:
        request: FastAPI request object
        identifier: Additional identifier for the key
        
    Returns:
        Rate limit key string
    """
    client_ip = get_remote_address(request)
    user_agent = request.headers.get("user-agent", "")[:50]
    
    # Create a unique key
    key_parts = ["rate_limit", client_ip, user_agent]
    if identifier:
        key_parts.append(identifier)
    
    return ":".join(key_parts)


def check_auth_rate_limit(request: Request, action: str = "auth") -> bool:
    """
    Check authentication-specific rate limits
    
    Args:
        request: FastAPI request object
        action: Action type (login, register, etc.)
        
    Returns:
        True if allowed, raises HTTPException if exceeded
    """
    key = get_rate_limit_key(request, f"auth_{action}")
    rate_limiter.check_rate_limit(key, settings.RATE_LIMIT_AUTH)
    return True


def check_register_rate_limit(request: Request) -> bool:
    """
    Check registration rate limits
    
    Args:
        request: FastAPI request object
        
    Returns:
        True if allowed, raises HTTPException if exceeded
    """
    key = get_rate_limit_key(request, "register")
    rate_limiter.check_rate_limit(key, settings.RATE_LIMIT_REGISTER)
    return True


def check_password_reset_rate_limit(request: Request) -> bool:
    """
    Check password reset rate limits
    
    Args:
        request: FastAPI request object
        
    Returns:
        True if allowed, raises HTTPException if exceeded
    """
    key = get_rate_limit_key(request, "password_reset")
    rate_limiter.check_rate_limit(key, settings.RATE_LIMIT_PASSWORD_RESET)
    return True


# Rate limiting decorators
def rate_limit_auth(action: str = "auth"):
    """Decorator for authentication rate limiting"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            request = kwargs.get('request')
            if request:
                check_auth_rate_limit(request, action)
            return func(*args, **kwargs)
        return wrapper
    return decorator


def rate_limit_register():
    """Decorator for registration rate limiting"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            request = kwargs.get('request')
            if request:
                check_register_rate_limit(request)
            return func(*args, **kwargs)
        return wrapper
    return decorator


def rate_limit_password_reset():
    """Decorator for password reset rate limiting"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            request = kwargs.get('request')
            if request:
                check_password_reset_rate_limit(request)
            return func(*args, **kwargs)
        return wrapper
    return decorator
