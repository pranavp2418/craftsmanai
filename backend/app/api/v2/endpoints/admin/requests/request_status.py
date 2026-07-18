from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_
from app.api import deps
from app.models.user import User
from app.models.design import Design, DesignStatus

router = APIRouter()

@router.get("/request-status-distribution")
async def get_request_status_distribution(
    db: AsyncSession = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    # Only count non-deleted, non-archived designs
    query = select(Design.status, func.count(Design.id)).where(
        and_(Design.is_deleted == False, Design.is_archived == False)
    ).group_by(Design.status)
    result = await db.execute(query)
    rows = result.all()
    
    # Map detailed statuses to UI categories (aligned with dashboard/request_status.py)
    mapping = {
        "DETECTED": [DesignStatus.GENERATING],
        "QUOTE_REQUESTED": [DesignStatus.UNDER_REVIEW, DesignStatus.QUOTES_REQUESTED],
        "QUOTE_RECEIVED": [DesignStatus.QUOTE_RECEIVED],
        "IN_PROGRESS": [DesignStatus.DRAFT, DesignStatus.GENERATED, DesignStatus.SHARED, DesignStatus.REFINEMENT_REQUESTED],
        "APPROVED": [DesignStatus.APPROVED],
        "DESIGN_REJECTED": [DesignStatus.DESIGN_REJECTED],
        "MANUFACTURER_APPROVED": [DesignStatus.MANUFACTURER_APPROVED],
        "IN_PRODUCTION": [DesignStatus.IN_PRODUCTION],
        "COMPLETED": [DesignStatus.COMPLETED],
        "SENT_TO_MANUFACTURER": [DesignStatus.SENT_TO_MANUFACTURER],
        "FAILED": [DesignStatus.REJECTED]
    }
    
    distribution = {k: 0 for k in mapping.keys()}
    for status, count in rows:
        for cat, statuses in mapping.items():
            if status in statuses:
                distribution[cat] += count
                break
                
    return distribution
