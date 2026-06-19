from typing import Dict
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.api import deps
from app.models.user import User
from app.models.customer import Customer
from app.models.order import Order

router = APIRouter()

@router.get("/kpi", response_model=Dict[str, int])
async def get_customer_kpi(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
):
    """
    Get basic KPI stats for customers and orders.
    """

    # Total customers
    total_customers_result = await db.execute(select(func.count()).select_from(Customer))
    total_customers = total_customers_result.scalar() or 0

    # Active customers
    active_customers_result = await db.execute(
        select(func.count()).where(Customer.is_active == True)
    )
    active_customers = active_customers_result.scalar() or 0

    # Inactive customers
    inactive_customers_result = await db.execute(
        select(func.count()).where(Customer.is_active == False)
    )
    inactive_customers = inactive_customers_result.scalar() or 0

    # Total orders
    total_orders_result = await db.execute(select(func.count()).select_from(Order))
    total_orders = total_orders_result.scalar() or 0

    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "inactive_customers": inactive_customers,
        "total_orders": total_orders
    }