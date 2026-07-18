from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.production_sheet import ProductionSheet
from app.models.user import User
from app.schemas.production_sheet import ProductionSheetResponse


router = APIRouter()


@router.get("/", response_model=ProductionSheetResponse)
def get_production_sheet(
	variant_id: int = Query(..., ge=1),
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
):
	production_sheet = (
		db.query(ProductionSheet)
		.filter(
			ProductionSheet.variant_id == variant_id,
			ProductionSheet.user_id == current_user.id,
		)
		.first()
	)

	if not production_sheet:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production sheet not found")

	return production_sheet
