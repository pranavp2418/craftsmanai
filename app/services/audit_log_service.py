from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert
import logging

from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


class AuditLogService:
    """Service for logging analytics access and other audit events"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_analytics_access(
        self,
        user_id: int,
        endpoint: str,
        filters: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Log analytics endpoint access for audit trail
        
        Args:
            user_id: ID of the user accessing analytics
            endpoint: The analytics endpoint accessed (e.g., '/metrics', '/conversion-funnel')
            filters: Optional filter parameters used
            ip_address: Optional IP address of the requester
            user_agent: Optional user agent string
            success: Whether the request was successful
            error_message: Error message if request failed
        """
        try:
            audit_entry = AuditLog(
                user_id=user_id,
                action=f"analytics.{endpoint}",
                resource_type="analytics",
                resource_id=endpoint,
                ip_address=ip_address,
                user_agent=user_agent,
                success=success,
                error_message=error_message,
                extra_data={
                    "endpoint": endpoint,
                    "filters": filters or {},
                },
                timestamp=datetime.now(timezone.utc),
            )
            
            self.db.add(audit_entry)
            await self.db.commit()
            
            logger.info(
                f"Analytics access logged: user_id={user_id}, endpoint={endpoint}, "
                f"success={success}, filters={filters}"
            )
        except Exception as e:
            # Don't let audit logging failures break the main flow
            await self.db.rollback()
            logger.error(f"Failed to log analytics access: {str(e)}", exc_info=True)

    async def log_validation_error(
        self,
        user_id: int,
        endpoint: str,
        validation_errors: list,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        """
        Log validation errors for analytics endpoints
        
        Args:
            user_id: ID of the user making the request
            endpoint: The analytics endpoint accessed
            validation_errors: List of validation error details
            ip_address: Optional IP address of the requester
            user_agent: Optional user agent string
        """
        await self.log_analytics_access(
            user_id=user_id,
            endpoint=endpoint,
            ip_address=ip_address,
            user_agent=user_agent,
            success=False,
            error_message=f"Validation errors: {validation_errors}",
        )

    async def log_authorization_failure(
        self,
        user_id: int,
        endpoint: str,
        reason: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        """
        Log authorization failures for analytics endpoints
        
        Args:
            user_id: ID of the user making the request
            endpoint: The analytics endpoint accessed
            reason: Reason for authorization failure
            ip_address: Optional IP address of the requester
            user_agent: Optional user agent string
        """
        await self.log_analytics_access(
            user_id=user_id,
            endpoint=endpoint,
            ip_address=ip_address,
            user_agent=user_agent,
            success=False,
            error_message=f"Authorization failure: {reason}",
        )