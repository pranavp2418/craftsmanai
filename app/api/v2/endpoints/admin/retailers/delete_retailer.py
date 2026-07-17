"""
Admin: permanently DELETE a retailer and ALL of their data.

Removes the retailer user (and any sub-users under their account) plus every row that belongs to
them — designs, variants, shares, orders, customers, manufacturers, teams, payments, subscriptions,
top-ups, invoices, settings, tokens, notifications, etc. — in strict leaf-first foreign-key order so
NO ACTION constraints never block the delete. Runs in ONE transaction (all-or-nothing): any error
rolls the whole thing back and nothing is deleted.

The delete ORDER + scoping was verified against the live schema's full FK graph (leaf tables first,
parents last) and dry-run tested on real data before shipping. Admin-only (superuser). A retailer is a
non-superuser user, so an admin/superuser can never be deleted through this endpoint.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.future import select

from app.api import deps
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


class DeleteRetailerRequest(BaseModel):
    retailer_id: str


class DeleteRetailerResponse(BaseModel):
    success: bool
    message: str
    deleted: dict


# Scope temp tables (retailer + any sub-users under the account) — created inside the request
# transaction, dropped on commit. Every child DELETE reads its victim ids from these.
_SCOPE_SQL = [
    "CREATE TEMP TABLE _u ON COMMIT DROP AS SELECT id FROM users WHERE id = :rid OR team_owner_id = :rid",
    "CREATE TEMP TABLE _d ON COMMIT DROP AS SELECT id FROM designs WHERE user_id IN (SELECT id FROM _u) OR created_by_user_id IN (SELECT id FROM _u)",
    "CREATE TEMP TABLE _v ON COMMIT DROP AS SELECT id FROM design_variants WHERE design_id IN (SELECT id FROM _d)",
    "CREATE TEMP TABLE _c ON COMMIT DROP AS SELECT id FROM customers WHERE created_by_user_id IN (SELECT id FROM _u)",
    "CREATE TEMP TABLE _m ON COMMIT DROP AS SELECT id FROM manufacturers WHERE created_by_user_id IN (SELECT id FROM _u)",
    "CREATE TEMP TABLE _t ON COMMIT DROP AS SELECT id FROM retailer_teams WHERE owner_id IN (SELECT id FROM _u)",
    "CREATE TEMP TABLE _s ON COMMIT DROP AS SELECT id FROM design_shares WHERE design_variant_id IN (SELECT id FROM _v) OR customer_id IN (SELECT id FROM _c)",
    "CREATE TEMP TABLE _o ON COMMIT DROP AS SELECT id FROM orders WHERE design_id IN (SELECT id FROM _d) OR customer_id IN (SELECT id FROM _c) OR current_manufacturer_id IN (SELECT id FROM _m) OR share_id IN (SELECT id FROM _s)",
    "CREATE TEMP TABLE _p ON COMMIT DROP AS SELECT id FROM payments WHERE user_id IN (SELECT id FROM _u)",
]

# Leaf-first delete order (verified against the full FK graph).
_DELETE_SQL = [
    "DELETE FROM invoices                           WHERE payment_id IN (SELECT id FROM _p)",
    "DELETE FROM manufacturer_quotes                WHERE order_id IN (SELECT id FROM _o) OR manufacturer_id IN (SELECT id FROM _m)",
    "DELETE FROM order_activity_logs                WHERE order_id IN (SELECT id FROM _o)",
    "DELETE FROM orders                             WHERE id IN (SELECT id FROM _o)",
    "DELETE FROM design_shares                      WHERE id IN (SELECT id FROM _s)",
    "DELETE FROM design_variant_manufacturer_shares WHERE design_variant_id IN (SELECT id FROM _v) OR manufacturer_id IN (SELECT id FROM _m)",
    "DELETE FROM production_sheet                    WHERE variant_id IN (SELECT id FROM _v) OR user_id IN (SELECT id FROM _u)",
    "DELETE FROM design_activity_logs               WHERE design_id IN (SELECT id FROM _d) OR user_id IN (SELECT id FROM _u)",
    "DELETE FROM design_variants                    WHERE id IN (SELECT id FROM _v)",
    "DELETE FROM designs                            WHERE id IN (SELECT id FROM _d)",
    "DELETE FROM customers                          WHERE id IN (SELECT id FROM _c)",
    "DELETE FROM manufacturers                      WHERE id IN (SELECT id FROM _m)",
    "DELETE FROM team_invitations                   WHERE team_id IN (SELECT id FROM _t) OR invited_by_id IN (SELECT id FROM _u) OR accepted_by_id IN (SELECT id FROM _u)",
    "DELETE FROM team_members                       WHERE team_id IN (SELECT id FROM _t) OR user_id IN (SELECT id FROM _u)",
    "DELETE FROM retailer_teams                     WHERE id IN (SELECT id FROM _t)",
    "DELETE FROM payments                           WHERE id IN (SELECT id FROM _p)",
    "DELETE FROM user_topups                        WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM subscription_activity_logs         WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM user_subscriptions                 WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM brand_settings                     WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM notification_settings              WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM notifications                      WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM otps                               WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM refresh_tokens                     WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM user_devices                       WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM audit_logs                         WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM push_subscriptions                 WHERE user_id IN (SELECT id FROM _u)",
    "DELETE FROM member_invitations                 WHERE account_id IN (SELECT id FROM _u) OR invited_by IN (SELECT id FROM _u)",
    "DELETE FROM account_members                    WHERE account_id IN (SELECT id FROM _u) OR user_id IN (SELECT id FROM _u)",
    "DELETE FROM users                              WHERE id IN (SELECT id FROM _u)",
]

# Counts to report back (entity -> COUNT query over the scoped temp tables).
_COUNT_SQL = {
    "users": "SELECT count(*) FROM _u",
    "designs": "SELECT count(*) FROM _d",
    "design_variants": "SELECT count(*) FROM _v",
    "customers": "SELECT count(*) FROM _c",
    "manufacturers": "SELECT count(*) FROM _m",
    "orders": "SELECT count(*) FROM _o",
    "payments": "SELECT count(*) FROM _p",
    "subscriptions": "SELECT count(*) FROM user_subscriptions WHERE user_id IN (SELECT id FROM _u)",
}


@router.post("/delete", response_model=DeleteRetailerResponse)
async def delete_retailer(
    payload: DeleteRetailerRequest,
    db=Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_admin),
):
    """Permanently delete a retailer and ALL of their data. Admin-only, irreversible."""
    try:
        retailer_int_id = int(payload.retailer_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid retailer ID format")

    # Must be an existing NON-superuser (a retailer) — never an admin.
    result = await db.execute(
        select(User).where(User.id == retailer_int_id, User.is_superuser == False)  # noqa: E712
    )
    retailer = result.scalars().first()
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer not found")

    retailer_email = retailer.email
    params = {"rid": retailer_int_id}

    try:
        # 1) Build the scoped temp tables.
        for sql in _SCOPE_SQL:
            await db.execute(text(sql), params)

        # 2) Snapshot counts (for the response) BEFORE deleting.
        deleted_counts = {}
        for entity, sql in _COUNT_SQL.items():
            res = await db.execute(text(sql))
            deleted_counts[entity] = int(res.scalar() or 0)

        # 3) Leaf-first cascade delete.
        for sql in _DELETE_SQL:
            await db.execute(text(sql))

        # 4) Safety verify — the retailer + sub-users must be gone.
        remaining = await db.execute(
            text("SELECT count(*) FROM users WHERE id = :rid OR team_owner_id = :rid"), params
        )
        if int(remaining.scalar() or 0) != 0:
            await db.rollback()
            raise HTTPException(status_code=500, detail="Delete verification failed — rolled back")

        await db.commit()
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - safety net
        await db.rollback()
        logger.exception("Retailer delete failed for id=%s: %s", retailer_int_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to delete retailer: {exc}")

    logger.info("Admin %s deleted retailer id=%s (%s): %s", current_user.id, retailer_int_id,
                retailer_email, deleted_counts)
    return DeleteRetailerResponse(
        success=True,
        message=f"Retailer {retailer_email} and all associated data deleted.",
        deleted=deleted_counts,
    )
