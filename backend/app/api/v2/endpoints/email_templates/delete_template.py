from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from typing import Any
from uuid import UUID

from app.core.database import get_db
from app.models.email_template import EmailTemplate
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.delete("/email-templates/{template_id}")
def delete_email_template(
    *,
    db = Depends(get_db),
    template_id: UUID
) -> Any:
    """
    Delete an email template.
    
    This will permanently delete the template. Deleted templates cannot
    be recovered.
    
    **Note:** Before deleting a template, ensure it's not being used by
    any active email sending processes.
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
        
        # Delete template
        db.delete(template)
        db.commit()
        
        logger.info(f"Deleted email template: {template.key}")
        
        return {
            "success": True,
            "message": f"Email template '{template.key}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete email template: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete email template"
        )