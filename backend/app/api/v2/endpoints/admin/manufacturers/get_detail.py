from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, distinct
from app.api import deps
from app.models.user import User
from app.models.manufacturer import Manufacturer
from app.models.design import Design, DesignVariant, DesignVariantManufacturerShare
from app.models.order import ManufacturerQuote, ManufacturerQuoteStatus
from typing import Dict, Any

router = APIRouter()

@router.get("/{manufacturer_id}", response_model=Dict[str, Any])
async def get_admin_manufacturer_detail(
    manufacturer_id: int,
    db: AsyncSession = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    result = await db.execute(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    m = result.scalars().first()
    if not m:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
        
    jobs_res = await db.execute(
        select(func.count(DesignVariantManufacturerShare.id)).where(DesignVariantManufacturerShare.manufacturer_id == m.id)
    )
    jobs_received = jobs_res.scalar() or 0
    
    quotes_res = await db.execute(
        select(func.count(ManufacturerQuote.id)).where(ManufacturerQuote.manufacturer_id == m.id)
    )
    quotes_submitted = quotes_res.scalar() or 0
    
    approved_res = await db.execute(
        select(func.count(ManufacturerQuote.id)).where(
            ManufacturerQuote.manufacturer_id == m.id,
            ManufacturerQuote.status == ManufacturerQuoteStatus.APPROVED
        )
    )
    approved_jobs = approved_res.scalar() or 0
    
    retailers_res = await db.execute(
        select(func.count(distinct(Design.user_id)))
        .select_from(DesignVariantManufacturerShare)
        .join(DesignVariant, DesignVariant.id == DesignVariantManufacturerShare.design_variant_id)
        .join(Design, Design.id == DesignVariant.design_id)
        .where(DesignVariantManufacturerShare.manufacturer_id == m.id)
    )
    associated_retailers = retailers_res.scalar() or 0
    
    return {
        "manufacturer_id": m.id,
        "name": m.name,
        "email": m.emails,
        "contact_number": m.phone_number,
        "status": "ACTIVE" if m.is_active else "INACTIVE",
        "joined_date": m.created_at.date() if m.created_at else None,
        "stats": {
            "jobs_received": jobs_received,
            "quotes_submitted": quotes_submitted,
            "approved_jobs": approved_jobs,
            "associated_retailers": associated_retailers
        }
    }
