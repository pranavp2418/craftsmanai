from typing import Any, List
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, cast, Date
from app.api import deps
from app.models.user import User
from app.models.design import Design
from app.core.rate_limiter import limiter
from app.core.config import settings
import datetime
from pydantic import BaseModel

router = APIRouter()

class RequestsTrendItem(BaseModel):
    date: datetime.date
    count: int


@router.get("/requests-over-time", response_model=List[RequestsTrendItem])
@limiter.limit(settings.RATE_LIMIT_GLOBAL)
async def get_requests_trend(
    request: Request,
    range: str = Query("last_30_days"),
    db: AsyncSession = Depends(deps.get_db),
    admin: User = Depends(deps.get_current_admin)
):
    # Handle range
    days = 30
    if range == "last_7_days": days = 7
    elif range == "last_90_days": days = 90
    
    start_date = datetime.date.today() - datetime.timedelta(days=days)
    
    query = select(cast(Design.created_at, Date), func.count(Design.id)).where(cast(Design.created_at, Date) >= start_date).group_by(cast(Design.created_at, Date))
    result = await db.execute(query.order_by(cast(Design.created_at, Date)))
    rows = result.all()
    
    return [{"date": row[0], "count": row[1]} for row in rows]

