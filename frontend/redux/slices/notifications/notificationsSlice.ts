import axiosInstance from '@/src/utils/hooks/axios';

export interface NotificationItem {
  id?: string;
  title?: string;
  body?: string;
  message?: string;
  read?: boolean;
  is_read?: boolean;
  created_at?: string;
  [key: string]: any;
}

export interface NotifyUserPayload {
  userId: string;
  title: string;
  message: string;
  notification_type?: string;
}

export const addNotifications = (payload: NotificationItem | NotificationItem[]) => ({
  type: 'notifications/add',
  payload,
});

export const updateNotificationReadStatus = (payload: { id?: string; all?: boolean; read?: boolean }) => ({
  type: 'notifications/updateRead',
  payload,
});

export const setNotificationsLoaded = () => ({
  type: 'notifications/loaded',
});

export const setNotifications = (payload: NotificationItem[]) => ({
  type: 'notifications/set',
  payload,
});

export const notifyUser = (payload: NotifyUserPayload) => async () => {
  const { userId, title, message, notification_type } = payload;
  const params = { title, message, notification_type: notification_type || 'general' };
  const response = await axiosInstance.post(`/api/v2/endpoints/notify/user/${userId}`, null, { params });
  return response.data;
};

interface NotificationsState {
  notifications: NotificationItem[];
  loaded: boolean;
}

const initialState: NotificationsState = {
  notifications: [],
  loaded: false,
};

export default function notificationsReducer(state = initialState, action: any) {
  switch (action.type) {
    case 'notifications/add': {
      const items = Array.isArray(action.payload) ? action.payload : [action.payload];
      const filteredItems = items.filter((item) => item && item.type !== 'init');
      return { ...state, notifications: [...filteredItems, ...state.notifications], loaded: true };
    }
    case 'notifications/set': {
      const items = Array.isArray(action.payload) ? action.payload : [];
      const filteredItems = items.filter((item) => item && item.type !== 'init');
      return { ...state, notifications: filteredItems, loaded: true };
    }
    case 'notifications/updateRead': {
      if (action.payload.all) {
        return {
          ...state,
          notifications: state.notifications.map((n) => ({ ...n, read: true, is_read: true })),
        };
      }
      if (action.payload.id) {
        return {
          ...state,
          notifications: state.notifications.map((n) =>
            String(n.id) === String(action.payload.id)
              ? { ...n, read: !!action.payload.read, is_read: !!action.payload.read }
              : n,
          ),
        };
      }
      return state;
    }
    case 'notifications/loaded': {
      return { ...state, loaded: true };
    }
    default:
      return state;
  }
}
