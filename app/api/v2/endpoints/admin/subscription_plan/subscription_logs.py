import csv
from io import StringIO
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.core.dependencies import get_db, get_current_superuser as get_current_admin
from app.models.subscription import SubscriptionActivityLog, SubscriptionEventType
from app.models.user import User
from app.schemas.subscription import SubscriptionActivityLogsResponse

router = APIRouter()


@router.get("/", response_model=SubscriptionActivityLogsResponse)
def get_subscription_logs(
    *,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    event_type: Optional[SubscriptionEventType] = None,
    current_user: User = Depends(get_current_admin)
):
    """
    Get all subscription activity logs for admin.
    Features: Paginated, Search by retailer, Filter by event type.
    """
    offset = (page - 1) * limit
    
    query = db.query(
        SubscriptionActivityLog,
        User.full_name.label("retailer_name"),
        User.email.label("retailer_email")
    ).join(User, SubscriptionActivityLog.user_id == User.id)
    
    if search:
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )
        
    if event_type:
        query = query.filter(SubscriptionActivityLog.event_type == event_type)
        
    total_count = query.count()
    
    rows = query.order_by(desc(SubscriptionActivityLog.created_at)).offset(offset).limit(limit).all()
    
    data = []
    for row in rows:
        log = row[0]
        retailer_name = row[1]
        
        data.append({
            "id": log.id,
            "event_type": log.event_type.value,
            "retailer_name": retailer_name or "Unknown",
            "retailer_id_str": f"RET-{str(log.user_id)[:8].upper()}",
            "plan_name": log.plan_name,
            "old_plan_name": log.old_plan_name,
            "triggered_by": log.triggered_by,
            "created_at": log.created_at
        })
        
    return {
        "success": True,
        "data": data,
        "total": total_count,
        "page": page,
        "total_pages": (total_count + limit - 1) // limit if limit > 0 else 1
    }


@router.get("/export")
def export_subscription_logs_csv(
    *,
    db: Session = Depends(get_db),
    search: Optional[str] = None,
    event_type: Optional[SubscriptionEventType] = None,
    current_user: User = Depends(get_current_admin)
):
    """
    Export all matching subscription activity logs to a CSV file.
    """
    query = db.query(
        SubscriptionActivityLog,
        User.full_name.label("retailer_name")
    ).join(User, SubscriptionActivityLog.user_id == User.id)
    
    if search:
        query = query.filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )
    if event_type:
        query = query.filter(SubscriptionActivityLog.event_type == event_type)
        
    rows = query.order_by(desc(SubscriptionActivityLog.created_at)).all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Event Type", "Retailer", "Retailer ID", "Plan Details", "Triggered By", "Date"])
    
    for row in rows:
        log, retailer_name = row
        
        plan_details = log.plan_name or "N/A"
        if log.old_plan_name:
            plan_details = f"{log.old_plan_name} -> {log.plan_name}"
            
        writer.writerow([
            log.event_type.value,
            retailer_name or "Unknown",
            f"RET-{str(log.user_id)[:8].upper()}",
            plan_details,
            log.triggered_by,
            log.created_at.strftime("%Y-%m-%d %I:%M %p")
        ])
    
    csv_content = output.getvalue()
    output.close()
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=subscription_activity_logs.csv"
        }
    )
