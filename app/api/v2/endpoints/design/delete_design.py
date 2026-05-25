from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design import DesignResponse
from app.services.design_service import DesignService


router = APIRouter()


@router.delete("/{design_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_design(
    design_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = DesignService(db)
    design = service.get_design_for_team_member(design_id=design_id, user=current_user)
    if not design:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")

    service.delete_design(design)
    return None
