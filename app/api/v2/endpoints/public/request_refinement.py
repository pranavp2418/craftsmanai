from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.public import PublicStatusUpdateRequest, PublicStatusUpdateResponse
from app.models.design import DesignShareStatus
from app.services.design_sharing_service import DesignSharingService

router = APIRouter()


@router.post("/request-refinement", response_model=PublicStatusUpdateResponse)
def request_refinement(
    payload: PublicStatusUpdateRequest,
    db: Session = Depends(get_db),
):
    """Public endpoint for customers to request refinement of a shared design."""
    share_service = DesignSharingService(db)

    share = share_service.get_by_token(payload.token)
    if not share:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired share token",
        )

    if share.status != DesignShareStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot request refinement for design with status: {share.status.value}",
        )

    share_service.update_status(
        share,
        status=DesignShareStatus.NEEDS_REFINEMENT,
        comment=payload.comment,
    )

    return PublicStatusUpdateResponse(
        success=True,
        message="Refinement requested successfully",
    )