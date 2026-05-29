from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from typing import Callable
import time
import logging

from .rate_limiter import rate_limiter, get_rate_limit_key
from .config import settings

logger = logging.getLogger(__name__)


class GlobalRateLimitMiddleware(BaseHTTPMiddleware):
    """Global rate limiting middleware"""
    
    def __init__(self, app, rate_limit: str = None):
        super().__init__(app)
        self.rate_limit = rate_limit or settings.RATE_LIMIT_GLOBAL

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate rate limit key
        key = get_rate_limit_key(request)
        
        try:
            # Check rate limit
            rate_limiter.check_rate_limit(key, rate_limit_str=self.rate_limit)
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            headers = rate_limiter.get_rate_limit_headers(key, rate_limit_str=self.rate_limit)
            for header_key, header_value in headers.items():
                response.headers[header_key] = header_value
            
            return response
            
        except HTTPException as e:
            # Return rate limit error
            return Response(
                content=str(e.detail),
                status_code=e.status_code,
                headers=e.headers if hasattr(e, 'headers') else {}
            )
        except Exception as e:
            logger.error(f"Rate limiting middleware error: {str(e)}")
            # Allow request if rate limiter fails
            return await call_next(request)


class IPBasedRateLimitMiddleware(BaseHTTPMiddleware):
    """IP-based rate limiting middleware"""
    
    def __init__(self, app, rate_limit: str = None):
        super().__init__(app)
        self.rate_limit = rate_limit or settings.RATE_LIMIT_GLOBAL_IP

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get client IP
        client_ip = get_remote_address(request)
        key = f"ip_rate_limit:{client_ip}"
        
        try:
            # Check rate limit
            rate_limiter.check_rate_limit(key, rate_limit_str=self.rate_limit)
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers
            headers = rate_limiter.get_rate_limit_headers(key, rate_limit_str=self.rate_limit)
            for header_key, header_value in headers.items():
                response.headers[header_key] = header_value
            
            return response
            
        except HTTPException as e:
            return Response(
                content=str(e.detail),
                status_code=e.status_code,
                headers=e.headers if hasattr(e, 'headers') else {}
            )
        except Exception as e:
            logger.error(f"IP rate limiting middleware error: {str(e)}")
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
        
        # Add CORS headers if not already present
        if "Access-Control-Allow-Origin" not in response.headers:
            # This will be handled by CORS middleware, but add fallback
            response.headers["Access-Control-Allow-Origin"] = "*"
        
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
