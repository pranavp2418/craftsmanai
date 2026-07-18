from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api import deps
from app.models.user import User
from app.models.customer import Customer
from app.models.order import Order, OrderStatus

router = APIRouter()


@router.get("/{customer_id}", response_model=Dict[str, Any])
async def get_customer_with_orders(
    customer_id: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
):
    """
    Get customer details along with order statistics.
    """

    try:
        customer_int_id = int(customer_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid customer ID")

    # Fetch customer and retailer
    result = await db.execute(
        select(Customer, User)
        .outerjoin(User, Customer.created_by_user_id == User.id)
        .where(Customer.id == customer_int_id)
    )

    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer, retailer = row

    # Total Orders
    total_orders_result = await db.execute(
        select(func.count()).where(Order.customer_id == customer_int_id)
    )
    total_orders = total_orders_result.scalar() or 0

    # Completed Orders
    completed_orders_result = await db.execute(
        select(func.count()).where(
            Order.customer_id == customer_int_id,
            Order.status == OrderStatus.COMPLETED
        )
    )
    completed_orders = completed_orders_result.scalar() or 0

    # Active Orders
    active_orders_result = await db.execute(
        select(func.count()).where(
            Order.customer_id == customer_int_id,
            Order.status != OrderStatus.COMPLETED
        )
    )
    active_orders = active_orders_result.scalar() or 0

    return {
        "customer": {
            "id": str(customer.id),
            "name": customer.full_name,
            "email": customer.emails,
            "phone": customer.phone_number,
            "location": customer.location,
            "status": "ACTIVE" if customer.is_active else "INACTIVE",
            "created_at": customer.created_at,
            "last_active": customer.updated_at,
            "retailer": {
                "id": str(retailer.id),
                "name": retailer.full_name or retailer.email,
                "email": retailer.email
            } if retailer else None
        },
        "orders": {
            "total_orders": total_orders,
            "completed_orders": completed_orders,
            "active_orders": active_orders
        }
    }