"""REST endpoints for listing and managing user notifications."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationResponse,
    UnreadCountResponse,
    MarkReadResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter()


@router.get("/", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List notifications for the current user."""
    service = NotificationService(db)
    return service.list_notifications(
        current_user.id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the number of unread notifications for the current user."""
    service = NotificationService(db)
    count = service.get_unread_count(current_user.id)
    return UnreadCountResponse(unread_count=count)


@router.post("/mark-read", response_model=MarkReadResponse)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark all notifications as read for the current user."""
    service = NotificationService(db)
    count = service.mark_all_as_read(current_user.id)
    return MarkReadResponse(success=True, marked_count=count)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_one_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a single notification as read."""
    service = NotificationService(db)
    success = service.mark_as_read(notification_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    # Re-fetch the notification to return it
    notifications = service.list_notifications(
        current_user.id, limit=1, offset=0
    )
    for n in notifications.items:
        if n.id == notification_id:
            return n
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Notification not found",
    )


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a single notification."""
    service = NotificationService(db)
    success = service.delete(notification_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )