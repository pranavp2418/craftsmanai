"""
Admin: a retailer's GENERATION HISTORY — every design they created, newest first.

For each generation we return the input image(s) the retailer uploaded, the generated OUTPUT image
(the design's base render), the prompt text, the jewellery type and the date. Paginated, ordered by
created_at DESC. Admin-only.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.future import select

from app.api import deps
from app.models.user import User

router = APIRouter()


class RetailerHistoryRequest(BaseModel):
    retailer_id: str
    page: int = 1
    limit: int = 20


def _as_list(input_image_url: Optional[str], input_image_urls: Any) -> List[str]:
    """Normalise the two input-image columns (a single URL + a JSON array) into one clean list."""
    urls: List[str] = []
    if isinstance(input_image_urls, list):
        urls.extend([u for u in input_image_urls if u])
    elif isinstance(input_image_urls, str) and input_image_urls.strip():
        urls.append(input_image_urls.strip())
    if input_image_url and input_image_url not in urls:
        urls.insert(0, input_image_url)
    # de-dupe, keep order
    seen, out = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


@router.post("/history", response_model=Dict[str, Any])
async def get_retailer_history(
    payload: RetailerHistoryRequest,
    db=Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
):
    """Paginated generation history for a retailer — input image(s), output image, prompt, date, DESC."""
    try:
        retailer_int_id = int(payload.retailer_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid retailer ID format")

    page = max(1, payload.page)
    limit = min(max(1, payload.limit), 100)
    offset = (page - 1) * limit

    # Retailer must exist and be a non-admin.
    res = await db.execute(
        select(User).where(User.id == retailer_int_id, User.is_superuser == False)  # noqa: E712
    )
    if not res.scalars().first():
        raise HTTPException(status_code=404, detail="Retailer not found")

    total = (await db.execute(
        text("SELECT count(*) FROM designs WHERE user_id = :rid"), {"rid": retailer_int_id}
    )).scalar() or 0

    # One page of designs (each = one create/generation), newest first.
    design_rows = (await db.execute(text(
        """
        SELECT d.id, d.design_code, d.name, d.jewellery_type, d.user_prompt,
               d.input_image_url, d.input_image_urls, d.status, d.created_at
        FROM designs d
        WHERE d.user_id = :rid
        ORDER BY d.created_at DESC
        LIMIT :limit OFFSET :offset
        """
    ), {"rid": retailer_int_id, "limit": limit, "offset": offset})).mappings().all()

    design_ids = [r["id"] for r in design_rows]

    # ALL variants for those designs in one query: base render (v0) + every refine, oldest→newest so the
    # base shows first and refines follow in order. Each carries its OWN output image, prompt and refs.
    variants_by_design: Dict[int, List[dict]] = {d: [] for d in design_ids}
    if design_ids:
        var_rows = (await db.execute(text(
            """
            SELECT dv.id, dv.design_id, dv.version_number, dv.variant_name, dv.base_design_image_url,
                   dv.prompt_used, dv.reference_images_json, dv.created_at
            FROM design_variants dv
            WHERE dv.design_id = ANY(:ids)
            ORDER BY dv.design_id, dv.version_number ASC, dv.created_at ASC
            """
        ), {"ids": design_ids})).mappings().all()
        for v in var_rows:
            ref = v["reference_images_json"]
            refs = [u for u in ref if u] if isinstance(ref, list) else ([ref] if isinstance(ref, str) and ref.strip() else [])
            ver = v["version_number"]
            variants_by_design.setdefault(v["design_id"], []).append({
                "variant_id": v["id"],
                "version": ver,
                "label": "Base" if (ver in (0, None)) else f"Refine {ver}",
                "output_image": v["base_design_image_url"],
                "prompt": v["prompt_used"],
                "reference_images": refs,
                "created_at": v["created_at"].isoformat() if v["created_at"] else None,
            })

    history = [
        {
            "design_id": r["id"],
            "design_code": r["design_code"],
            "name": r["name"],
            "jewellery_type": r["jewellery_type"],
            "prompt": r["user_prompt"],              # the original create prompt
            "input_images": _as_list(r["input_image_url"], r["input_image_urls"]),  # ALL inputs
            "status": r["status"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "variants": variants_by_design.get(r["id"], []),  # base + all refines
        }
        for r in design_rows
    ]

    total_pages = (total + limit - 1) // limit if total else 1
    return {
        "history": history,
        "pagination": {
            "page": page,
            "limit": limit,
            "total_items": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        },
    }
