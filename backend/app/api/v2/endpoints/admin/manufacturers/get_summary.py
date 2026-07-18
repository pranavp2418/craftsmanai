from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.api import deps
from app.models.user import User
from app.models.manufacturer import Manufacturer
from app.models.design import DesignVariantManufacturerShare
from pydantic import BaseModel

router = APIRouter()

class AdminManufacturerSummaryResponse(BaseModel):
    total_manufacturers: int
    active_manufacturers: int
    inactive_manufacturers: int
    total_jobs: int

@router.get("/summary", response_model=AdminManufacturerSummaryResponse)
async def get_admin_manufacturers_summary(
    db: AsyncSession = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    total_res = await db.execute(select(func.count(Manufacturer.id)))
    total_manufacturers = total_res.scalar() or 0
    
    active_res = await db.execute(select(func.count(Manufacturer.id)).where(Manufacturer.is_active == True))
    active_manufacturers = active_res.scalar() or 0
    
    disabled_res = await db.execute(select(func.count(Manufacturer.id)).where(Manufacturer.is_active == False))
    disabled_manufacturers = disabled_res.scalar() or 0
    
    jobs_res = await db.execute(select(func.count(DesignVariantManufacturerShare.id)))
    total_jobs = jobs_res.scalar() or 0
    
    return {
        "total_manufacturers": total_manufacturers,
        "active_manufacturers": active_manufacturers,
        "inactive_manufacturers": disabled_manufacturers,
        "total_jobs": total_jobs
    }