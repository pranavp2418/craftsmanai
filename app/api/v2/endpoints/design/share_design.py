from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design import DesignShareCreateRequest, DesignShareResponse
from app.services.design_service import DesignService
from app.services.design_sharing_service import DesignSharingService


router = APIRouter()


@router.post("/{design_id}/share", response_model=DesignShareResponse, status_code=status.HTTP_201_CREATED)
def share_design(
    design_id: int,
    payload: DesignShareCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    design_service = DesignService(db)
    sharing_service = DesignSharingService(db)

    design = design_service.get_design_for_user(design_id=design_id, user_id=current_user.id)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    share = sharing_service.create_share(
        design_id=design.id,
        customer_id=payload.customer_id,
        comment=payload.comment,
    )

    return share
