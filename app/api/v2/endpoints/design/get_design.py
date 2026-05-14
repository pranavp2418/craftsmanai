from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design import DesignResponse
from app.services.design_service import DesignService


router = APIRouter()


@router.get("/{design_id}", response_model=DesignResponse)
def get_design(
    design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = DesignService(db)
    design = service.get_design_for_user(design_id=design_id, user_id=current_user.id)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")
    return design
