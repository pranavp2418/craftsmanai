from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design_variant import VariantRestoreResponse
from app.services.design_service import DesignService
from app.services.design_variant_service import DesignVariantService


router = APIRouter()


@router.patch("/variants/{variant_id}/restore", response_model=VariantRestoreResponse)
def restore_design_variant(
	variant_id: int,
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
):
	design_service = DesignService(db)
	variant_service = DesignVariantService(db)

	variant = variant_service.get_variant(variant_id)
	if not variant:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

	design = design_service.get_design(variant.design_id)
	if not design:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Design not found")
	if design.user_id != current_user.id:
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not allowed to restore this variant")
	if design.is_archived:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot restore a variant while its parent design is archived")

	if not variant.is_archived:
		return VariantRestoreResponse(id=variant.id, message=f"variant {variant.id} restored")

	variant_service.restore_variant(
		variant,
		message=f"Variant {variant.variant_name} restored by {current_user.username}",
	)
	return VariantRestoreResponse(id=variant.id, message=f"variant {variant.id} restored")
