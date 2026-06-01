from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, or_
from sqlalchemy.orm import aliased
from app.api import deps
from app.models.user import User
from app.models.customer import Customer
from app.models.order import Order
import json

router = APIRouter()


def parse_customer_emails(raw_emails):
    """Parse customer emails stored as JSON, raw string, or malformed legacy data."""
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
    current_user: User = Depends(deps.get_current_user),

    status: Optional[str] = Query("ALL"),
    name: Optional[str] = Query(None),

    search: Optional[str] = Query(
        None,
        description="Global search across customer + retailer"
    ),

    subfilter: Optional[str] = Query("recently_added"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):

    skip = (page - 1) * limit

    # Alias so SQLAlchemy doesn't confuse with other User joins
    RetailerUser = aliased(User, flat=True)

    # -------------------------
    # Orders aggregation subquery
    # -------------------------
    orders_subq = (
        select(
            Order.customer_id,
            func.count(Order.id).label("total_orders"),
            func.count(
                case((Order.status != "COMPLETED", 1))
            ).label("active_orders")
        )
        .group_by(Order.customer_id)
        .subquery()
    )

    # -----------------------------------------------------------------------
    # Base query — FLAT scalar columns only. No ORM relationship loading.
    # This avoids the GroupingError caused by contains_eager/joinedload
    # injecting un-aggregated columns into subquery-wrapped count queries.
    # -----------------------------------------------------------------------
    def base_query():
        return (
            select(
                Customer,
                func.coalesce(orders_subq.c.total_orders, 0).label("total_orders"),
                func.coalesce(orders_subq.c.active_orders, 0).label("active_orders"),
                RetailerUser.full_name.label("retailer_name"),
                RetailerUser.email.label("retailer_email"),
            )
            .outerjoin(orders_subq, Customer.id == orders_subq.c.customer_id)
            .outerjoin(RetailerUser, RetailerUser.id == Customer.created_by_user_id)
        )

    def apply_filters(q, search_terms=None):
        if status and status.upper() != "ALL":
            is_act = (status.upper() == "ACTIVE")
            q = q.where(Customer.is_active == is_act)
        if name:
            q = q.where(Customer.full_name.ilike(f"%{name}%"))
        if search:
            terms = search_terms or search.split()
            for term in terms:
                t = f"%{term}%"
                q = q.where(
                    or_(
                        Customer.full_name.ilike(t),
                        Customer.emails.ilike(t),
                        Customer.phone_number.ilike(t),
                        Customer.location.ilike(t),
                        RetailerUser.full_name.ilike(t),
                        RetailerUser.email.ilike(t),
                    )
                )
        return q

    # -------------------------
    # Build data query
    # -------------------------
    query = apply_filters(base_query())

    # Ordering
    sf = (subfilter or "").lower()
    if sf.startswith("letter:"):
        letter = sf.split(":", 1)[1].upper()
        query = query.where(Customer.full_name.ilike(f"{letter}%"))
        query = query.order_by(Customer.full_name.asc())
    elif sf == "alphabetical":
        query = query.order_by(Customer.full_name.asc())
    else:
        query = query.order_by(Customer.created_at.desc())

    # -------------------------
    # Count query (separate, avoids wrapping aggregate SELECT as subquery)
    # -------------------------
    count_q = (
        select(func.count(func.distinct(Customer.id)))
        .select_from(Customer)
        .outerjoin(RetailerUser, RetailerUser.id == Customer.created_by_user_id)
    )

    if status and status.upper() != "ALL":
        is_act = (status.upper() == "ACTIVE")
        count_q = count_q.where(Customer.is_active == is_act)
    if name:
        count_q = count_q.where(Customer.full_name.ilike(f"%{name}%"))
    if search:
        terms = search.split()
        for term in terms:
            t = f"%{term}%"
            count_q = count_q.where(
                or_(
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

    total_result = await db.execute(count_q)
    total_customers = total_result.scalar() or 0

    # -------------------------
    # Paginated data fetch
    # -------------------------
    result = await db.execute(query.offset(skip).limit(limit))
    rows = result.all()

    customers = []
    for row in rows:
        customer        = row[0]
        total_orders    = row[1]
        active_orders   = row[2]
        retailer_name   = row[3]
        retailer_email  = row[4]

        customers.append({
            "id":           str(customer.id),
            "name":         customer.full_name,
            "emails": parse_customer_emails(customer.emails),
            "phone":        customer.phone_number,
            "location":     customer.location,
            "status":       "ACTIVE" if customer.is_active else "INACTIVE",
            "created_at":   customer.created_at,
            "last_active":  customer.updated_at,
            "retailer": {
                "name":  retailer_name,
                "email": retailer_email,
            } if retailer_name else None,
            "total_orders":  total_orders,
            "active_orders": active_orders,
        })
    total_pages = (total_customers + limit - 1) // limit

    return {
        "customers": customers,
        "pagination": {
            "page":        page,
            "limit":       limit,
            "total_items": total_customers,
            "total_pages": total_pages,
            "has_next":    page < total_pages,
            "has_prev":    page > 1,
        }
    }