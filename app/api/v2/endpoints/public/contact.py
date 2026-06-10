import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.contact import ContactSubmissionCreate, ContactMessageResponse
from app.models.contact import ContactSubmission
from app.tasks.email_tasks import send_contact_notification_email

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/contact", response_model=ContactMessageResponse)
async def submit_contact_form(
    contact_data: ContactSubmissionCreate,
    db: Session = Depends(get_db),
):
    """
    Public endpoint for the contact form.
    Saves the submission to the database and dispatches a Celery task
    to send the notification email.
    """
    try:
        # Save to database
        submission = ContactSubmission(
            full_name=contact_data.full_name,
            business_name=contact_data.business_name,
            email=contact_data.email,
            phone=contact_data.phone,
            store_type=contact_data.store_type,
            interest=contact_data.interest,
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

        logger.info(
            f"Contact form submission saved: ID={submission.id}, "
            f"Name={submission.full_name}, Business={submission.business_name}, "
            f"Email={submission.email}"
        )

        # Dispatch Celery task to send notification email
        send_contact_notification_email.delay(
            full_name=contact_data.full_name,
            business_name=contact_data.business_name,
            email=contact_data.email,
            phone=contact_data.phone,
            store_type=contact_data.store_type,
            interest=contact_data.interest,
        )

        # Mark email as dispatched
        submission.email_sent = True
        submission.email_sent_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            f"Contact notification email dispatched via Celery for "
            f"submission ID={submission.id}"
        )

        return ContactMessageResponse()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to process contact form submission: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please try again later.",
        )