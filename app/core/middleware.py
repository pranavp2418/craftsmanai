from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi.util import get_remote_address
from typing import Callable
import time
import logging

from .rate_limiter import rate_limiter
from .config import settings

logger = logging.getLogger(__name__)


class HybridRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Hybrid rate limiting middleware with two independent layers:

    Layer 1 (IP safety net):
        - Always applied for every request
        - Key format:  rl:ip:{client_ip}
        - Default limit: 1000/minute (configurable via settings.RATE_LIMIT_IP)

    Layer 2 (User-based strict limit):
        - Applied only when request.state.user exists (authenticated user)
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
        user = getattr(request.state, "user", None)
        if user is not None:
            user_id = getattr(user, "id", None) or str(user)
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