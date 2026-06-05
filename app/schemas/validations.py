import json
import re
from typing import Annotated, Iterable, Optional, Set, Type

from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BeforeValidator, EmailStr


def _normalize_email_value(value):
    if value is None:
        return value
    return str(value).strip().lower()


NormalizedEmailStr = Annotated[EmailStr, BeforeValidator(_normalize_email_value)]


def normalize_emails(emails: Optional[str], *, validate: bool = False) -> Set[str]:
    if not emails:
        return set()

    try:
        parsed_emails = json.loads(emails)
    except Exception:
        parsed_emails = emails

    normalized_emails: Set[str] = set()
    values = parsed_emails if isinstance(parsed_emails, list) else [parsed_emails]

    for value in values:
        if isinstance(value, dict):
            email_value = value.get("email")
        else:
            email_value = value

        if not email_value:
            continue

        email_text = str(email_value).strip().lower()
        if validate:
            try:
                validate_email(email_text, check_deliverability=False)
            except EmailNotValidError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid email format",
                )

        normalized_emails.add(email_text)

    return normalized_emails


def normalize_phone_number(phone_number: Optional[str], *, validate: bool = False) -> Optional[str]:
    if not phone_number:
        return None

    phone_text = phone_number.strip()
    if validate:
        if not re.fullmatch(r"\+[\d\s\-()]{3,20}", phone_text):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid phone number format",
            )

    normalized_phone = re.sub(r"[\s\-()]", "", phone_text)
    
    if validate:
        if len(normalized_phone) < 10 or len(normalized_phone) > 15:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Phone number must be between 10 and 15 digits (including country code)",
            )

    return normalized_phone


def find_contact_conflict(
    db: Session,
    *,
    created_by_user_id: int,
    emails: Optional[str],
    phone_number: Optional[str],
    models: Iterable[Type[object]],
) -> Optional[str]:
    candidate_emails = normalize_emails(emails, validate=True)
    candidate_phone = normalize_phone_number(phone_number, validate=True)

    if not candidate_emails and not candidate_phone:
        return None

    for model in models:
        existing_rows = (
            db.query(model.emails, model.phone_number)
            .filter(
                model.created_by_user_id == created_by_user_id,
                model.is_deleted == False,
            )
            .all()
        )

        for existing_emails, existing_phone in existing_rows:
            existing_phone_normalized = normalize_phone_number(existing_phone)
            if candidate_phone and existing_phone_normalized and existing_phone_normalized == candidate_phone:
                return "phone number"

            existing_email_values = normalize_emails(existing_emails)
            if candidate_emails and existing_email_values and candidate_emails.intersection(existing_email_values):
                return "email"

    return None
