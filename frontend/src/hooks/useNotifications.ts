import { useEffect, useState, useCallback } from 'react';
import socketManager from '@/src/lib/socket';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { 
  addNotifications, 
  setNotificationsLoaded,
  setNotifications,
  updateNotificationReadStatus, 
  NotificationItem 
} from '@/redux/slices/notifications/notificationsSlice';

export default function useNotifications(options?: { role?: string; userId?: string }) {
  const { role, userId } = options || {};
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.notifications.notifications);
  const loaded = useAppSelector((state) => state.notifications.loaded);
  const [connected, setConnected] = useState(false);

  const normalizeNotification = useCallback((item: any): NotificationItem => {
    const read = item?.read ?? item?.is_read ?? false;
    return {
      ...item,
      read: !!read,
      is_read: !!read,
    };
  }, []);

  const unwrapNotificationPayload = useCallback((payload: any): NotificationItem[] => {
    const event = Array.isArray(payload) ? payload[1] ?? payload[0] : payload;
    const item = Array.isArray(event) ? event[0] : event;

    if (!item) return [];

    const recent =
      Array.isArray(item?.recent_notifications)
        ? item.recent_notifications
        : Array.isArray(item?.data?.recent_notifications)
          ? item.data.recent_notifications
          : Array.isArray(item?.data?.recentNotifications)
            ? item.data.recentNotifications
            : null;

    if (item?.type === 'init') {
      return (recent ?? [])
        .filter((n: any) => n && n.type !== 'init')
        .map((n: any) => normalizeNotification(n));
    }

    if (recent) {
      return recent
        .filter((n: any) => n && n.type !== 'init')
        .map((n: any) => normalizeNotification(n));
    }

    return [normalizeNotification(item)];
  }, [normalizeNotification]);

  const isInitPayload = useCallback((payload: any): boolean => {
    const event = Array.isArray(payload) ? payload[1] ?? payload[0] : payload;
    const item = Array.isArray(event) ? event[0] : event;
    return !!item && item.type === 'init';
  }, []);

  const isForCurrent = useCallback((payload: any) => {
    try {
      const targetRole = payload?.target_role || payload?.recipient_role || payload?.role || payload?.scope;
      if (targetRole) {
        if (typeof targetRole === 'string') {
          if (role && targetRole.toLowerCase() !== role.toLowerCase()) return false;
        }
      }

      const targetId =
        payload?.retailer_id ||
        payload?.user_id ||
        payload?.recipient_id ||
        payload?.target_retailer_id;
      if (targetId) {
        if (userId && String(targetId) !== String(userId)) return false;
      }

      return true;
    } catch (e) {
      return true;
    }
  }, [role, userId]);

  useEffect(() => {
    if (!userId) {
      socketManager.disconnect();
      return;
    }

    const handleOpen = () => {
      setConnected(true);
      dispatch(setNotificationsLoaded());
    };
    const handleClose = () => setConnected(false);

    const handleNotification = (payload: any) => {
      const items = unwrapNotificationPayload(payload);
      if (items.length === 0) return;

      const filtered = items.filter((item) => isForCurrent(item));
      if (filtered.length === 0) return;

      if (isInitPayload(payload)) {
        dispatch(setNotifications(filtered));
        return;
      }

      dispatch(addNotifications(filtered));
    };

    const handleMessage = (payload: any) => {
      // If backend sends arrays or other messages, try to normalize
      if (Array.isArray(payload)) {
        const normalized = payload
          .map((p) => normalizeNotification(p))
          .filter(isForCurrent);
        if (normalized.length === 0) return;
        dispatch(addNotifications(normalized));
      }
    };

    socketManager.on('open', handleOpen);
    socketManager.on('close', handleClose);
    socketManager.on('notification', handleNotification);
    socketManager.on('message', handleMessage);

    // start connection (no-op if already connected)
    socketManager.connect();

    return () => {
      socketManager.off('open', handleOpen);
      socketManager.off('close', handleClose);
      socketManager.off('notification', handleNotification);
      socketManager.off('message', handleMessage);
    };
  }, [dispatch, role, userId, unwrapNotificationPayload, isForCurrent, normalizeNotification, isInitPayload]);

  const markAllRead = useCallback(() => {
    dispatch(updateNotificationReadStatus({ all: true }));
  }, [dispatch]);

  const markRead = useCallback((id: string) => {
    dispatch(updateNotificationReadStatus({ id, read: true }));
  }, [dispatch]);

  const pushLocalNotification = useCallback((item: NotificationItem) => {
    dispatch(addNotifications({ ...item, read: false }));
  }, [dispatch]);

  const unreadCount = notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);

  return {
    notifications,
    unreadCount,
    connected,
    loaded,
    markAllRead,
    pushLocalNotification,
    markRead,
  };
}
