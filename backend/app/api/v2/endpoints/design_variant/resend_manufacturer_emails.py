"""
POST /api/v2/design-variant/variants/{variant_id}/resend-manufacturer-emails

Re-send the manufacturer share email (and SMS) to every manufacturer
that the given design variant has been shared with.

The endpoint does NOT block the request thread while emails are being
sent. Instead, it dispatches a Celery background task per share
(``resend_manufacturer_share_email``) and returns immediately with a
summary of queued tasks so the caller can poll or display status to
the user.

The endpoint only requires the ``variant_id`` (path parameter); all
other information (manufacturer list, emails, phones, design owner,
brand settings, etc.) is fetched from the database by the background
task. The exact same email template used during the original share
(``EmailService.send_manufacturer_share``) is re-used so the resend
is indistinguishable from the first send to the manufacturer.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.manufacturer_variant_share import (
    ResendManufacturerEmailsResponse,
    ResendShareItem,
)
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService
from app.services.manufacturer_variant_share_service import (
    DesignVariantManufacturerShareService,
)
from app.tasks.resend_manufacturer_share_task import resend_manufacturer_share_email

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/variants/{variant_id}/resend-manufacturer-emails",
    response_model=ResendManufacturerEmailsResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Re-send manufacturer share emails for a design variant",
    description=(
        "Accepts a design variant id (path parameter) and dispatches a "
        "Celery background task that re-sends the manufacturer share "
        "email (and SMS) to every manufacturer that this variant has "
        "been shared with. All share / manufacturer / design / brand "
        "information is fetched from the database; no request body is "
        "required. Returns 202 Accepted with a summary of queued tasks."
    ),
)
def resend_manufacturer_share_emails(
    variant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Re-send the manufacturer share emails for a given variant.

    - ``variant_id`` (path): the design variant whose manufacturer
      shares we want to resend. All other information is loaded from
      the database by the Celery background task.
    """
    # ── 1. Validate variant + design access ─────────────────────────
    variant_service = DesignVariantService(db)
    design_service = DesignService(db)
    share_service = DesignVariantManufacturerShareService(db)

    variant = variant_service.get_variant(variant_id)
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Variant not found",
        )

    design = design_service.get_design_for_team_member(
        design_id=variant.design_id, user=current_user
    )
    if not design:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Design not found or you don't have access to it",
        )

    # ── 2. Load every manufacturer share for the variant ─────────────
    all_shares = share_service.list_for_variant(variant.id)

    # Filter to only PENDING and ACCEPTED shares for resend
    # PENDING: manufacturers who haven't responded yet (need nudging)
    # ACCEPTED: manufacturers who have accepted (may need reminders)
    # Excluded: REJECTED, QUOTED (no need to resend)
    shares = [
        share for share in all_shares
        if share.status in ("PENDING", "ACCEPTED")
    ]

    if not shares:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "No pending or accepted manufacturer shares found for this variant. "
                "Only shares with PENDING or ACCEPTED status can be resent. "
                "Share the variant with a manufacturer first via "
                "POST /api/v2/design-variant/variants/{variant_id}/share-with-manufacturer."
            ),
        )

    # ── 3. Dispatch one Celery task per share ────────────────────────
    items: list[ResendShareItem] = []
    queued_count = 0
    skipped_count = 0

    for share in shares:
        review_url = share_service.build_review_url(share)

        try:
            async_result = resend_manufacturer_share_email.delay(
                share_id=share.id,
                resend_by_user_id=current_user.id,
            )
            task_id = async_result.id
            items.append(
                ResendShareItem(
                    share_id=share.id,
                    manufacturer_id=share.manufacturer_id,
                    status="queued",
                    task_id=task_id,
                    review_url=review_url,
                    message="Email resend queued",
                )
            )
            queued_count += 1
        except Exception as exc:  # pragma: no cover - broker down
            logger.exception(
                "Failed to dispatch resend_manufacturer_share_email for "
                "share_id=%s: %s",
                share.id,
                exc,
            )
            items.append(
                ResendShareItem(
                    share_id=share.id,
                    manufacturer_id=share.manufacturer_id,
                    status="skipped",
                    task_id=None,
                    review_url=review_url,
                    message=f"Failed to queue email: {exc}",
                )
            )
            skipped_count += 1

    return ResendManufacturerEmailsResponse(
        variant_id=variant.id,
        total_shares=len(shares),
        queued_count=queued_count,
        skipped_count=skipped_count,
        background=True,
        message=(
            f"Queued {queued_count} email resend task(s) for variant "
            f"{variant.id} via Celery."
        ),
        items=items,
    )
