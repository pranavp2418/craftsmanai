from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.models.design import DesignStatus
from app.models.user import User
from app.schemas.design import DesignListResponse
from app.services.design_service import DesignService


router = APIRouter()


@router.get("/", response_model=DesignListResponse)
def list_designs(
    status: DesignStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = DesignService(db)
    items, total = service.list_designs(
        user=current_user,
        status=status,
        limit=limit,
        offset=offset,
    )
    items = [design for design in items if not getattr(design, "is_archived", False)]
    return DesignListResponse(items=items, total=total)
