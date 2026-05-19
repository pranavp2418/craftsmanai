from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from typing import Any
from uuid import UUID

from app.core.database import get_db
from app.schemas.email_template import EmailTemplateUpdate, EmailTemplateResponse
from app.models.email_template import EmailTemplate
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.patch("/email-templates/{template_id}", response_model=EmailTemplateResponse)
def update_email_template(
    *,
    db = Depends(get_db),
    template_id: UUID,
    template_in: EmailTemplateUpdate
) -> Any:
    """
    Update an email template.
    
    You can update any of the template fields including subject, content,
    and active status. Only provided fields will be updated.
    
    **Note:** Be careful when updating templates that are actively being used
    for sending emails, as changes will take effect immediately.
    """
    try:
        # Find existing template
        result = db.execute(
            select(EmailTemplate).where(EmailTemplate.id == template_id)
        )
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Email template with ID '{template_id}' not found"
            )
        
        # Update fields
        update_data = template_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(template, field, value)
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        logger.info(f"Updated email template: {template.key}")
        
        return template
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update email template: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update email template"
        )