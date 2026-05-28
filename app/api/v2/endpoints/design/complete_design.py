from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.design import DesignStatus
from app.models.user import User
from app.schemas.design import DesignResponse
from app.services.design_service import DesignService


router = APIRouter()


@router.patch("/{design_id}/complete", response_model=DesignResponse)
def complete_design(
	design_id: int,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
):
	service = DesignService(db)
	design = service.get_design(design_id)
	if not design:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")
	if design.user_id != current_user.id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not allowed to complete this design")

	updated_design = service.update_design(
		design,
		status=DesignStatus.COMPLETED,
		user=current_user,
		message=f"Design {design.design_code} marked as completed by {current_user.username}",
	)
	return updated_design
