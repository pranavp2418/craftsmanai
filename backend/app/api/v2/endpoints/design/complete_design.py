from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.design import DesignStatus, DesignVariant, DesignShare, DesignVariantManufacturerShare, ManufacturerShareStatus
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

	# Get all variant IDs for this design
	variant_ids = [
		v[0] for v in db.query(DesignVariant.id)
		.filter(
			DesignVariant.design_id == design.id,
			DesignVariant.is_deleted.is_(False),
		)
		.all()
	]

	# Check if any variant has been shared to a customer
	if variant_ids:
		customer_share = (
			db.query(DesignShare)
			.filter(
				DesignShare.design_variant_id.in_(variant_ids),
				DesignShare.customer_id.isnot(None),
			)
			.first()
		)
		if not customer_share:
			raise HTTPException(
				status_code=status.HTTP_400_BAD_REQUEST,
				detail="Design not shared to customer",
			)
	else:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Design has no variants",
		)

	# Check if the shared variant has been shared to any manufacturer
	manufacturer_share = (
		db.query(DesignVariantManufacturerShare)
		.filter(
			DesignVariantManufacturerShare.design_variant_id.in_(variant_ids),
		)
		.first()
	)
	if not manufacturer_share:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Design not shared to manufacturer",
		)

	# Check if any manufacturer quote has been approved
	approved_quote = (
		db.query(DesignVariantManufacturerShare)
		.filter(
			DesignVariantManufacturerShare.design_variant_id.in_(variant_ids),
			DesignVariantManufacturerShare.status == ManufacturerShareStatus.ACCEPTED,
		)
		.first()
	)
	if not approved_quote:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Manufacturer quote not approved",
		)

	updated_design = service.update_design(
		design,
		status=DesignStatus.COMPLETED,
		user=current_user,
		message=f"Design {design.design_code} marked as completed by {current_user.username}",
	)

	# Update corresponding Order status to COMPLETED
	from app.repositories.order import OrderRepository
	from app.models.order import OrderStatus
	order_repo = OrderRepository(db)
	order = order_repo.get_latest_by_design_id(design.id)
	if order:
		order_repo.update_status(order, status=OrderStatus.COMPLETED)

	return updated_design
