from fastapi import APIRouter, Depends, HTTPException, status
from typing import Any

from app.core.database import get_db
from app.schemas.email_template import EmailTemplateCreate, EmailTemplateResponse
from app.models.email_template import EmailTemplate
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/email-templates", response_model=EmailTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_email_template(
    *,
    db = Depends(get_db),
    template_in: EmailTemplateCreate
) -> Any:
    """
    Create a new email template.
    
    Email templates are used with the unified email system to send
    transactional emails like welcome emails, OTP verification, etc.
    
    **Template Variables:**
    Use {{variable_name}} syntax in subject, html_content, and text_content.
    These will be replaced with actual values when sending emails.
    
    Example template variables:
    - {{user_name}} - User's name
    - {{otp}} - One-time password
    - {{company_name}} - Company name
    
    **Required permissions:** Admin or authorized personnel only.
    """
    
    try:
        # Check if template key already exists
        from sqlalchemy import select
        result = db.execute(
            select(EmailTemplate).where(EmailTemplate.key == template_in.key)
        )
        existing_template = result.scalar_one_or_none()
        
        if existing_template:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email template with key '{template_in.key}' already exists"
            )
        
        # Create new template
        template = EmailTemplate(
            key=template_in.key,
            description=template_in.description,
            subject=template_in.subject,
            html_content=template_in.html_content,
            text_content=template_in.text_content,
            is_active=template_in.is_active,
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        logger.info(f"Created email template: {template.key}")
        
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create email template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create email template"
        )