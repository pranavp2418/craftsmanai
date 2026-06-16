from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.api import deps
from app.models.user import User
from app.models.design import Design, DesignStatus

router = APIRouter()

@router.get("/request-status-distribution")
async def get_request_status_distribution(
    db: AsyncSession = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    query = select(Design.status, func.count(Design.id)).group_by(Design.status)
    result = await db.execute(query)
    rows = result.all()
    
    # Map detailed statuses to UI categories
    mapping = {
        "pending": [DesignStatus.DRAFT, DesignStatus.GENERATING, DesignStatus.GENERATED],
        "in_progress": [DesignStatus.UNDER_REVIEW, DesignStatus.SHARED, DesignStatus.REFINEMENT_REQUESTED, DesignStatus.IN_PRODUCTION],
        "quotes_requested": [DesignStatus.QUOTES_REQUESTED],
        "quote_received": [DesignStatus.QUOTE_RECEIVED],
        "design_rejected": [DesignStatus.DESIGN_REJECTED],
        "manufacturer_approved": [DesignStatus.MANUFACTURER_APPROVED],
        "approved": [DesignStatus.APPROVED],
        "completed": [DesignStatus.COMPLETED],
        "sent_to_manufacturer": [DesignStatus.SENT_TO_MANUFACTURER],
        "failed": [DesignStatus.REJECTED]
    }
    
    distribution = {k: 0 for k in mapping.keys()}
    for status, count in rows:
        for cat, statuses in mapping.items():
            if status in statuses:
                distribution[cat] += count
                break
                
    return distribution
