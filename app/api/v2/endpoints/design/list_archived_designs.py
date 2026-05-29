from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_superuser as get_current_admin,get_current_user
from app.models.user import User
from app.schemas.design import DesignListResponse
from app.schemas.design_variant import PaginationMetadata
from app.services.design_service import DesignService


router = APIRouter()


@router.get("/archived", response_model=DesignListResponse)
def list_archived_designs(
	page: int = Query(1, ge=1),
	limit: int = Query(50, ge=1, le=100),
	db: Session = Depends(get_db),
	current_admin: User = Depends(get_current_user),
):
	service = DesignService(db)

	offset = (page - 1) * limit
	items = service.list_archived_designs(limit=limit, offset=offset)
	total = service.count_archived_designs()
	total_pages = (total + limit - 1) // limit if total > 0 else 0
	pagination = PaginationMetadata(
		page=page,
		limit=limit,
		total_items=total,
		total_pages=total_pages,
		has_next=page < total_pages,
		has_prev=page > 1,
	)

	return DesignListResponse(items=items, total=total, pagination=pagination)
