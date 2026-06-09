from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
import sqlalchemy as sa
from sqlalchemy.orm import aliased
from app.api import deps
from app.models.user import User
from app.models.customer import Customer
from app.models.order import Order
import json

router = APIRouter()


def parse_customer_emails(raw_emails):
    if not raw_emails:
        return []

    if isinstance(raw_emails, list):
        parsed = raw_emails
    else:
        try:
            parsed = json.loads(raw_emails)
        except Exception:
            return [{"label": "Work", "email": str(raw_emails)}]

    if isinstance(parsed, dict):
        parsed = [parsed]

    if not isinstance(parsed, list):
        return [{"label": "Work", "email": str(raw_emails)}]

    emails = []
    for item in parsed:
        if isinstance(item, dict):
            emails.append({
                "label": item.get("label") or "Work",
                "email": item.get("email") or "",
            })
        elif item:
            emails.append({"label": "Work", "email": str(item)})
    return emails


@router.get("/", response_model=Dict[str, Any])
async def get_customers(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),

    status: Optional[str] = Query("ALL"),
    name: Optional[str] = Query(None),
    search: Optional[str] = Query(None),

    subfilter: Optional[str] = Query("recently_added"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):

    skip = (page - 1) * limit

    RetailerUser = aliased(User, flat=True)

    # -------------------------
    # Orders aggregation subquery
    # -------------------------
    orders_subq = (
        sa.select(
            Order.customer_id,
            sa.func.count(Order.id).label("total_orders"),
            sa.func.count(
                sa.case((Order.status != "COMPLETED", 1))
            ).label("active_orders")
        )
        .group_by(Order.customer_id)
        .subquery()
    )

    # -------------------------
    # Base query
    # -------------------------
    def base_query():
        return (
            sa.select(
                Customer,
                sa.func.coalesce(orders_subq.c.total_orders, 0).label("total_orders"),
                sa.func.coalesce(orders_subq.c.active_orders, 0).label("active_orders"),
                sa.func.coalesce(RetailerUser.full_name, RetailerUser.username, RetailerUser.email).label("retailer_name"),
                RetailerUser.email.label("retailer_email"),
            )
            .outerjoin(orders_subq, Customer.id == orders_subq.c.customer_id)
            .outerjoin(RetailerUser, RetailerUser.id == Customer.created_by_user_id)
        )

    def apply_filters(q):
        if status and status.upper() != "ALL":
            q = q.where(Customer.is_active == (status.upper() == "ACTIVE"))

        if name:
            q = q.where(Customer.full_name.ilike(f"%{name}%"))

        if search:
            for term in search.split():
                t = f"%{term}%"
                q = q.where(
                    sa.or_(
                        Customer.full_name.ilike(t),
                        Customer.emails.ilike(t),
                        Customer.phone_number.ilike(t),
                        Customer.location.ilike(t),
                        RetailerUser.full_name.ilike(t),
                        RetailerUser.email.ilike(t),
                    )
                )
        return q

    query = apply_filters(base_query())

    # -------------------------
    # Ordering (FIXED)
    # -------------------------
    sf = (subfilter or "").lower()

    if sf.startswith("letter:"):
        letter = sf.split(":", 1)[1].upper()
        query = query.where(Customer.full_name.ilike(f"{letter}%"))
        query = query.order_by(sa.func.lower(Customer.full_name).asc())

    elif sf == "alphabetical":
        query = query.order_by(sa.func.lower(Customer.full_name).asc())

    else:
        query = query.order_by(Customer.created_at.desc())

    # -------------------------
    # Count query
    # -------------------------
    count_q = (
        sa.select(sa.func.count(sa.func.distinct(Customer.id)))
        .select_from(Customer)
        .outerjoin(RetailerUser, RetailerUser.id == Customer.created_by_user_id)
    )

    if status and status.upper() != "ALL":
        count_q = count_q.where(Customer.is_active == (status.upper() == "ACTIVE"))

    if name:
        count_q = count_q.where(Customer.full_name.ilike(f"%{name}%"))

    if search:
        for term in search.split():
            t = f"%{term}%"
            count_q = count_q.where(
                sa.or_(
                    Customer.full_name.ilike(t),
                    Customer.emails.ilike(t),
                    Customer.phone_number.ilike(t),
                    Customer.location.ilike(t),
                    RetailerUser.full_name.ilike(t),
                    RetailerUser.email.ilike(t),
                )
            )

    if sf.startswith("letter:"):
        letter = sf.split(":", 1)[1].upper()
        count_q = count_q.where(Customer.full_name.ilike(f"{letter}%"))

    total_customers = (await db.execute(count_q)).scalar() or 0

    # -------------------------
    # Fetch data
    # -------------------------
    result = await db.execute(query.offset(skip).limit(limit))
    rows = result.all()

    customers = []
    for row in rows:
        customer = row[0]

        customers.append({
            "id": str(customer.id),
            "name": customer.full_name,
            "emails": parse_customer_emails(customer.emails),
            "phone": customer.phone_number,
            "location": customer.location,
            "status": "ACTIVE" if customer.is_active else "INACTIVE",
            "created_at": customer.created_at,
            "last_active": customer.updated_at,
            "retailer": {
                "name": row[3],
                "email": row[4],
            },
            "total_orders": row[1],
            "active_orders": row[2],
        })

    total_pages = (total_customers + limit - 1) // limit

    return {
        "customers": customers,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total_customers,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }
    }