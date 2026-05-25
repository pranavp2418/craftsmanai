from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api import deps
from app.models.user import User

router = APIRouter()

# ------------------------------
# Pydantic Models
# ------------------------------

class UpdateRetailerStatusRequest(BaseModel):
    retailer_id: str
    status: str  # "ACTIVE" or "INACTIVE"

class UpdateRetailerStatusResponse(BaseModel):
    success: bool
    message: str

# ------------------------------
# Endpoint
# ------------------------------

@router.post(
    "/update-status",
    response_model=UpdateRetailerStatusResponse
)
async def update_retailer_status(
    payload: UpdateRetailerStatusRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
):
    """
    Update the status of a retailer.
    """

    # Validate retailer_id
    try:
        retailer_int_id = int(payload.retailer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid retailer ID format")

    # Fetch retailer
    result = await db.execute(
        select(User).where(User.id == retailer_int_id, User.is_superuser == False)
    )
    retailer = result.scalars().first()

    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    # Validate status
    if payload.status.upper() not in ["ACTIVE", "INACTIVE"]:
        raise HTTPException(status_code=400, detail="Status must be ACTIVE or INACTIVE")

    # Update status
    retailer.is_active = (payload.status.upper() == "ACTIVE")
    await db.commit()

    return UpdateRetailerStatusResponse(
        success=True,
        message=f"Retailer status updated to {payload.status.upper()}"
    )