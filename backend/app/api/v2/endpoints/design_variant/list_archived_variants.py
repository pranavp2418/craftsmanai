from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.design_variant import ArchivedDesignVariantListResponse, PaginationMetadata
from app.services.design_variant_service import DesignVariantService


router = APIRouter()


@router.get("/archived", response_model=ArchivedDesignVariantListResponse)
def list_archived_variants(
	page: int = Query(1, ge=1),
	limit: int = Query(20, ge=1, le=100),
	db: Session = Depends(get_db),
	current_user: User = Depends(get_current_active_user),
):
	variant_service = DesignVariantService(db)

	owner_id = current_user.team_owner_id if current_user.is_team_member and current_user.team_owner_id else current_user.id
	skip = (page - 1) * limit
	variants = variant_service.list_archived_variants(owner_id, skip=skip, limit=limit)
	total_items = variant_service.count_archived_variants(owner_id)
	total_pages = (total_items + limit - 1) // limit if total_items > 0 else 0

	pagination = PaginationMetadata(
		page=page,
		limit=limit,
		total_items=total_items,
		total_pages=total_pages,
		has_next=page < total_pages,
		has_prev=page > 1,
	)

	return ArchivedDesignVariantListResponse(
		items=[
			{
				"id": variant.id,
				"design_id": variant.design_id,
				"parent_variant_id": variant.parent_variant_id,
				"variant_name": variant.variant_name,
				"version_number": variant.version_number,
				"base_design_image_url": variant.base_design_image_url,
			}
			for variant in variants
		],
		pagination=pagination,
	)
