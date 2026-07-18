from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from typing import Any, Optional

from app.core.database import get_db
from app.schemas.email_template import EmailTemplateResponse, EmailTemplateListResponse
from app.models.email_template import EmailTemplate
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def _parse_bool(value: Optional[str]) -> Optional[bool]:
    """Convert string to boolean value."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if value.lower() in ("true", "1", "yes", "on"):
        return True
    if value.lower() in ("false", "0", "no", "off"):
        return False
    return None


@router.get("/email-templates", response_model=EmailTemplateListResponse)
def list_email_templates(
    *,
    db = Depends(get_db),
    is_active: Optional[str] = Query(None, description="Filter by active status (true/false)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return")
) -> Any:
    """
    List all email templates.
    
    You can filter by active status and paginate through results.
    This endpoint is useful for managing and reviewing all available
    email templates in the system.
    
    **Query Parameters:**
    - `is_active`: Filter by template status (true/false). If not provided, returns all templates.
    - `skip`: Number of records to skip (for pagination)
    - `limit`: Maximum number of records to return (default: 100, max: 1000)
    """
    try:
        # Parse is_active filter
        is_active_filter = _parse_bool(is_active)
        
        # Build query
        query = select(EmailTemplate)
        
        # Apply active filter if provided
        if is_active_filter is not None:
            query = query.where(EmailTemplate.is_active == is_active_filter)
        
        # Get total count
        count_query = select(func.count(EmailTemplate.id))
        if is_active_filter is not None:
            count_query = count_query.where(EmailTemplate.is_active == is_active_filter)
        
        total_result = db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Apply pagination and ordering
        query = query.order_by(EmailTemplate.key).offset(skip).limit(limit)
        
        # Execute query
        result = db.execute(query)
        templates = result.scalars().all()
        
        return EmailTemplateListResponse(
            success=True,
            total=total,
            templates=templates
        )
        
    except Exception as e:
        logger.error(f"Failed to list email templates: {e}")
        return EmailTemplateListResponse(
            success=False,
            total=0,
            templates=[]
        )