from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.design import DesignStatus
from app.models.user import User
from app.schemas.design import DesignUpdateRequest, DesignResponse
from app.services.design_service import DesignService


router = APIRouter()


@router.put("/{design_id}", response_model=DesignResponse)
def update_design(
    design_id: int,
    payload: DesignUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = DesignService(db)
    design = service.get_design_for_team_member(design_id=design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    status_value = payload.status if payload.status else None

    updated = service.update_design(
        design,
        name=payload.name,
        jewellery_type=payload.jewellery_type,
        user_prompt=payload.user_prompt,
        input_image_url=payload.input_image_url,
        status=status_value,
        user=current_user,
        message=f"Design updated by {current_user.username}",
    )
    return updated
