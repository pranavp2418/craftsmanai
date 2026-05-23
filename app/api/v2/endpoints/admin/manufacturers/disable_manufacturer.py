from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.models.user import User
from app.models.manufacturer import Manufacturer

router = APIRouter()


@router.post("/{manufacturer_id}/disable")
async def disable_manufacturer(
    manufacturer_id: int,
    db: AsyncSession = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    result = await db.execute(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    m = result.scalars().first()
    if not m:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
        
    m.is_active = False
    await db.commit()
    
    return {"message": "Manufacturer disabled successfully"}
