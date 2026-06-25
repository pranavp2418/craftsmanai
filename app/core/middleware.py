from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi.util import get_remote_address
from typing import Callable, Optional
import time
import logging

from jose import jwt, JWTError
from .rate_limiter import rate_limiter
from .config import settings

logger = logging.getLogger(__name__)


def _extract_user_id_from_request(request: Request) -> Optional[str]:
    """
    Extract the user ID from the Authorization header's JWT access token.

    Returns the ``sub`` (or ``user_id``) claim on success, or ``None`` when
    the header is missing, the token is malformed / expired, or the token
    type is not ``access``.  This function is intentionally lenient – any
    failure simply falls back to IP-only rate limiting.
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None

    token = auth.split(" ", 1)[1].strip()

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except (JWTError, Exception):
        # Invalid / expired / unverifiable token → fall back to IP-only
        return None

    # Only accept access tokens (skip refresh / reset / etc.)
    token_type = payload.get("type")
    if token_type is not None and token_type != "access":
        return None

    return payload.get("sub") or payload.get("user_id")


class HybridRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Hybrid rate limiting middleware with two independent layers:

    Layer 1 (IP safety net):
        - Always applied for every request
        - Key format:  rl:ip:{client_ip}
        - Default limit: 1000/minute (configurable via settings.RATE_LIMIT_IP)

    Layer 2 (User-based strict limit):
        - Applied only when a valid JWT access token is present in the
          Authorization header.
        - Key format:  rl:user:{user_id}
        - Default limit: 60/minute (configurable via settings.RATE_LIMIT_USER)

    Both limits are checked independently. If either is exceeded, a 429
    HTTPException is raised. Rate limit headers are based on the IP key.
    """

    def __init__(self, app, ip_rate_limit: str = None, user_rate_limit: str = None):
        super().__init__(app)
        self.ip_rate_limit = ip_rate_limit or settings.RATE_LIMIT_IP
        self.user_rate_limit = user_rate_limit or settings.RATE_LIMIT_USER

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Bypass rate limiting for health check paths
        if request.url.path in ["/health", "/api/v2/health", "/api/v2/endpoints/health"]:
            return await call_next(request)

        # ------------------------------------------------------------------
        # Layer 1 – IP safety net (always applied)
        # ------------------------------------------------------------------
        client_ip = get_remote_address(request)
        ip_key = f"rl:ip:{client_ip}"

        try:
            rate_limiter.check_rate_limit(ip_key, rate_limit_str=self.ip_rate_limit)
        except HTTPException as exc:
            logger.warning(f"IP rate limit exceeded — client_ip={client_ip}")
            return Response(
                content=exc.detail,
                status_code=exc.status_code,
                headers=exc.headers if hasattr(exc, 'headers') else {}
            )
        except Exception as exc:
            # Fail-safe: if rate limiter throws an unexpected error, log and
            # allow the request to proceed.
            logger.error(
                f"IP rate limiter unexpected error: {exc} — "
                f"client_ip={client_ip}, allowing request"
            )

        # ------------------------------------------------------------------
        # Layer 2 – User-based strict limit (authenticated users only)
        # ------------------------------------------------------------------
        user_id = _extract_user_id_from_request(request)
        if user_id is not None:
            user_key = f"rl:user:{user_id}"

            try:
                rate_limiter.check_rate_limit(
                    user_key, rate_limit_str=self.user_rate_limit
                )
            except HTTPException as exc:
                logger.warning(
                    f"User rate limit exceeded — user_id={user_id}, "
                    f"client_ip={client_ip}"
                )
                return Response(
                    content=exc.detail,
                    status_code=exc.status_code,
                    headers=exc.headers if hasattr(exc, 'headers') else {}
                )
            except Exception as exc:
                # Fail-safe: if rate limiter throws an unexpected error, log
                # and allow the request to proceed.
                logger.error(
                    f"User rate limiter unexpected error: {exc} — "
                    f"user_id={user_id}, client_ip={client_ip}, "
                    f"allowing request"
                )

        # ------------------------------------------------------------------
        # Process the request
        # ------------------------------------------------------------------
        try:
            response = await call_next(request)

            # Add rate limit headers based on the IP key
            headers = rate_limiter.get_rate_limit_headers(
                ip_key, rate_limit_str=self.ip_rate_limit
            )
            for header_key, header_value in headers.items():
                response.headers[header_key] = header_value

            return response

        except Exception as e:
            logger.error(f"Rate limiting middleware error: {str(e)}")
            return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Content Security Policy - prevents XSS attacks
        # Adjust the policy based on your application's needs
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # Adjust based on needs
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: http:",
            "font-src 'self' data:",
            "connect-src 'self' wss: https:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'"
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        
        # Permissions Policy - restrict browser features
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # Prevent Adobe Flash/AIR access
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        
        # HSTS - enforce HTTPS (only in production)
        from app.core.config import settings
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all requests with timing"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        # Log request
        logger.info(
            f"Request started: {request.method} {request.url.path} - "
            f"Client: {get_remote_address(request)} - "
            f"User-Agent: {request.headers.get('user-agent', 'Unknown')[:100]}"
        )

        try:
            response = await call_next(request)

            # Calculate processing time
            process_time = time.time() - start_time

            # Log response
            logger.info(
                f"Request completed: {request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Time: {process_time:.4f}s - "
                f"Client: {get_remote_address(request)}"
            )

            # Add processing time header
            response.headers["X-Process-Time"] = str(process_time)

            return response

        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"Request failed: {request.method} {request.url.path} - "
                f"Error: {str(e)} - "
                f"Time: {process_time:.4f}s - "
                f"Client: {get_remote_address(request)}"
            )
            raise


class HealthCheckMiddleware(BaseHTTPMiddleware):
    """Bypass rate limiting for health checks"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Bypass rate limiting for health checks
        if request.url.path in ["/health", "/api/v2/health", "/api/v2/endpoints/health"]:
            return await call_next(request)

        return await call_next(request)