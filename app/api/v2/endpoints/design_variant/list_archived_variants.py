from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design_variant import DesignVariantListResponse, PaginationMetadata
from app.services.design_variant_service import DesignVariantService


router = APIRouter()


@router.get("/archived", response_model=DesignVariantListResponse)
def list_archived_variants(
	page: int = Query(1, ge=1),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
):
	variant_service = DesignVariantService(db)

	skip = (page - 1) * limit
	variants = variant_service.list_archived_variants(current_user.id, skip=skip, limit=limit)
	total_items = variant_service.count_archived_variants(current_user.id)
	total_pages = (total_items + limit - 1) // limit if total_items > 0 else 0

	pagination = PaginationMetadata(
		page=page,
		limit=limit,
		total_items=total_items,
		total_pages=total_pages,
		has_next=page < total_pages,
		has_prev=page > 1,
	)

	return DesignVariantListResponse(items=variants, pagination=pagination)
