from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from app.api import deps
from app.models.user import User
from app.models.design import Design, DesignStatus

router = APIRouter()    


# Pydantic models for request and response
class RetailerInfoRequest(BaseModel):
    retailer_id: str


class RetailerStats(BaseModel):
    total_requests: int
    active_requests: int
    completed_requests: int


class RetailerInfoResponse(BaseModel):
    retailer: dict
    stats: RetailerStats


@router.post("/info", response_model=RetailerInfoResponse)
async def get_retailer_info(
    payload: RetailerInfoRequest = Body(...),
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
):
    """
    Get retailer information along with aggregated request stats.
    """

    try:
        retailer_int_id = int(payload.retailer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid retailer ID")

    # Fetch retailer
    result = await db.execute(
        select(User).where(User.id == retailer_int_id, User.is_superuser == False)
    )
    retailer = result.scalars().first()

    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    # Aggregate requests (designs) for this retailer
    total_requests_query = select(func.count(Design.id)).where(Design.user_id == retailer_int_id)
    active_requests_query = select(func.count(Design.id)).where(Design.user_id == retailer_int_id, Design.status != DesignStatus.COMPLETED)
    completed_requests_query = select(func.count(Design.id)).where(Design.user_id == retailer_int_id, Design.status == DesignStatus.COMPLETED)

    total_requests_result = await db.execute(total_requests_query)
    total_requests = total_requests_result.scalar() or 0

    active_requests_result = await db.execute(active_requests_query)
    active_requests = active_requests_result.scalar() or 0

    completed_requests_result = await db.execute(completed_requests_query)
    completed_requests = completed_requests_result.scalar() or 0

    return RetailerInfoResponse(
        retailer={
            "id": str(retailer.id),
            "full_name": retailer.full_name,
            "email": retailer.email,
            "phone": retailer.whatsapp_number,
            "status": "ACTIVE" if retailer.is_active else "INACTIVE",
            "created_at": retailer.created_at,
            "last_active": retailer.updated_at
        },
        stats=RetailerStats(
            total_requests=total_requests,
            active_requests=active_requests,
            completed_requests=completed_requests
        )
    )