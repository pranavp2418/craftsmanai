from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from typing import Any
from uuid import UUID

from app.core.database import get_db
from app.schemas.email_template import EmailTemplateResponse
from app.models.email_template import EmailTemplate
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/email-templates/{template_id}", response_model=EmailTemplateResponse)
def get_email_template(
    *,
    db = Depends(get_db),
    template_id: UUID
) -> Any:
    """
    Get an email template by ID.
    
    Returns the full template details including subject, HTML content,
    and text content.
    """
    try:
        result = db.execute(
            select(EmailTemplate).where(EmailTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Email template with ID '{template_id}' not found"
            )
        
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get email template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve email template"
        )


@router.get("/email-templates/key/{template_key}", response_model=EmailTemplateResponse)
def get_email_template_by_key(
    *,
    db = Depends(get_db),
    template_key: str
) -> Any:
    """
    Get an email template by its unique key.
    
    This is useful when you need to look up a template by its identifier
    (e.g., "welcome_mail", "signup_otp") rather than its UUID.
    """
    try:
        result = db.execute(
            select(EmailTemplate).where(
                EmailTemplate.key == template_key,
                EmailTemplate.is_active == True
            )
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Email template with key '{template_key}' not found or inactive"
            )
        
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get email template by key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve email template"
        )