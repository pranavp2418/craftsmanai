from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func
import json
from app.api import deps
from app.models.user import User
from app.models.manufacturer import Manufacturer
from app.models.design import DesignVariantManufacturerShare
from app.models.order import ManufacturerQuote
from app.core.dependencies import get_db, get_current_user

router = APIRouter()

@router.get("/", response_model=Dict[str, Any])
async def get_admin_manufacturers(
    db: AsyncSession = Depends(deps.get_db),
    status: str = Query("all", description="Filter by status: active, inactive, all"),
    subfilter: Optional[str] = Query(
        "recently_added",
        description="Combined subfilter: 'recently_added', 'alphabetical', or 'letter:<A-Z>'"
    ),
    search: Optional[str] = Query(None, description="Search by name, email, phone number, or location"),
    sort_by: Optional[str] = Query("recently_added", description="Sort by: 'recently_added' or 'alphabetical'"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    # admin: User = Depends(deps.get_current_admin)
    current_user: User = Depends(get_current_user)
):
    skip = (page - 1) * limit

    # Base query
    query = select(Manufacturer)

    # Search filter
    if search and isinstance(search, str) and search.strip():
        search_term = search.strip()
        query = query.where(
            or_(
                Manufacturer.name.ilike(f"%{search_term}%"),
                Manufacturer.emails.ilike(f"%{search_term}%"),
                Manufacturer.phone_number.ilike(f"%{search_term}%"),
                Manufacturer.location.ilike(f"%{search_term}%")
            )
        )

    # Status filter
    status_lower = status.lower() if status and isinstance(status, str) else "all"
    if status_lower == "active":
        query = query.where(Manufacturer.is_active == True)
    elif status_lower in ("inactive", "disabled"):
        query = query.where(Manufacturer.is_active == False)

    # Apply combined subfilter (recently_added / alphabetical / letter)
    if subfilter and isinstance(subfilter, str) and subfilter.strip():
        subfilter_lower = subfilter.strip().lower()
        if subfilter_lower.startswith("letter:"):
            letter = subfilter.split(":", 1)[1].upper() if ":" in subfilter else ""
            if letter and letter.isalpha() and len(letter) == 1:
                query = query.where(Manufacturer.name.ilike(f"{letter}%"))

    # Apply sort_by parameter
    if sort_by and isinstance(sort_by, str) and sort_by.strip().lower() == "alphabetical":
        query = query.order_by(Manufacturer.name.asc())
    else:  # Default or recently_added
        query = query.order_by(Manufacturer.created_at.desc())

    # Total count for pagination    
    count_subq = query.subquery()
    count_res = await db.execute(select(func.count()).select_from(count_subq))
    total_items = count_res.scalar() or 0

    # Pagination
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    manufacturers = result.scalars().all()

    manu_list = []
    for m in manufacturers:
        # Jobs count
        jobs_res = await db.execute(
            select(func.count(DesignVariantManufacturerShare.id)).where(DesignVariantManufacturerShare.manufacturer_id == m.id)
        )
        jobs_count = jobs_res.scalar() or 0

        # Quotes count
        quotes_res = await db.execute(
            select(func.count(ManufacturerQuote.id)).where(ManufacturerQuote.manufacturer_id == m.id)
        )
        quotes_count = quotes_res.scalar() or 0

        manu_list.append({
            "manufacturer_id": m.id,
            "name": m.name,
             "email": [
            {
                "label": item.get("label"),
                "email": item.get("email"),
            }
            for item in json.loads(m.emails or "[]")
        ],
            "contact_number": m.phone_number,
            "location": m.location,
            "status": "ACTIVE" if m.is_active else "INACTIVE",
            "jobs_received": jobs_count,
            "quotes_submitted": quotes_count,
            "joined_date": m.created_at.date() if m.created_at else None
        })

    # Available letters
    letter_query = select(func.distinct(func.substr(Manufacturer.name, 1, 1)))
    
    # Apply search filter to available letters
    if search:
        letter_query = letter_query.where(
            or_(
                Manufacturer.name.ilike(f"%{search}%"),
                Manufacturer.emails.ilike(f"%{search}%"),
                Manufacturer.phone_number.ilike(f"%{search}%"),
                Manufacturer.location.ilike(f"%{search}%")
            )
        )
    
    # Apply status filter to available letters
    if status_lower == "active":
        letter_query = letter_query.where(Manufacturer.is_active == True)
    elif status_lower in ("inactive", "disabled"):
        letter_query = letter_query.where(Manufacturer.is_active == False)
        
    result_letters = await db.execute(letter_query)
    available_letters = sorted([row[0].upper() for row in result_letters.fetchall() if row[0] and row[0].isalpha()])

    return {
        "manufacturers": manu_list,
        "pagination": {
            "page": page,
            "total_pages": (total_items + limit - 1) // limit
        },
        "available_letters": available_letters
    }