import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface NotificationSettings {
  user_id: number;
  email_notifications: boolean;
  push_notifications: boolean;
  design_approval_alerts: boolean;
  manufacturer_updates: boolean;
  quote_reminders: boolean;
  updated_at?: string;
}

export interface UpdateNotificationSettingsPayload {
  email_notifications: boolean;
  push_notifications: boolean;
  design_approval_alerts: boolean;
  manufacturer_updates: boolean;
  quote_reminders: boolean;
}

interface NotificationState {
  settingsStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  settingsError: string | null;
  settingsItem: NotificationSettings | null;
  updateStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  updateError: string | null;
}

const initialState: NotificationState = {
  settingsStatus: 'idle',
  settingsError: null,
  settingsItem: null,
  updateStatus: 'idle',
  updateError: null,
};

export const fetchNotificationSettings = createAsyncThunk<
  NotificationSettings,
  void,
  { rejectValue: string }
>('retailer/notification/fetch', async (_, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.get('/api/v2/notification-settings/');
    return response.data as NotificationSettings;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to load notification settings.';
    return rejectWithValue(message);
  }
},
{
  condition: (_, { getState }) => {
    const state = getState() as any;
    const { settingsStatus } = state.retailerNotification;
    if (settingsStatus === 'loading') {
      return false;
    }
  },
});

export const updateNotificationSettings = createAsyncThunk<
  NotificationSettings,
  UpdateNotificationSettingsPayload,
  { rejectValue: string }
>('retailer/notification/update', async (payload, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.put('/api/v2/notification-settings/', payload);
    return response.data as NotificationSettings;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to update notification settings.';
    return rejectWithValue(message);
  }
});

const notificationSlice = createSlice({
  name: 'retailerNotification',
  initialState,
  reducers: {
    clearNotificationFeedback(state) {
      state.updateError = null;
      state.updateStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotificationSettings.pending, (state) => {
        state.settingsStatus = 'loading';
        state.settingsError = null;
      })
      .addCase(fetchNotificationSettings.fulfilled, (state, action) => {
        state.settingsStatus = 'succeeded';
        state.settingsItem = action.payload;
      })
      .addCase(fetchNotificationSettings.rejected, (state, action) => {
        state.settingsStatus = 'failed';
        state.settingsError = action.payload || 'Failed to load notification settings.';
      })
      .addCase(updateNotificationSettings.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateNotificationSettings.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.settingsItem = action.payload;
      })
      .addCase(updateNotificationSettings.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || 'Failed to update notification settings.';
      });
  },
});

export const { clearNotificationFeedback } = notificationSlice.actions;

export default notificationSlice.reducer;
