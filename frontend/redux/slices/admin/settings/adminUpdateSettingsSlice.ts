import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface AdminSettingsUpdatePayload {
  default_currency: string;
  default_request_status?: string;
  default_lead_time_unit: string;
  ai_provider: string;
  retry_limit: number;
  timeout_seconds: number;
  link_expiry_days: number;
  ai_image_detection: boolean;
  guided_visual_quiz: boolean;
  prompt_only_flow: boolean;
  manufacturer_notifications: boolean;
  email_notifications: boolean;
  in_app_notifications: boolean;
}

interface AdminUpdateSettingsState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

const initialState: AdminUpdateSettingsState = {
  loading: false,
  success: false,
  error: null,
};

export const updateAdminSettings = createAsyncThunk<
  unknown,
  AdminSettingsUpdatePayload,
  { rejectValue: string }
>('admin/settings/updateAdminSettings', async (payload, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.post('/api/v2/admin/settings/', payload);
    return response.data;
  } catch (error: unknown) {
    const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
    return rejectWithValue(
      err.response?.data?.detail ??
        err.response?.data?.message ??
        err.message ??
        'Failed to update admin settings'
    );
  }
});

const adminUpdateSettingsSlice = createSlice({
  name: 'adminUpdateSettings',
  initialState,
  reducers: {
    resetAdminUpdateSettingsState: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateAdminSettings.pending, (state) => {
        state.loading = true;
        state.success = false;
        state.error = null;
      })
      .addCase(updateAdminSettings.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(updateAdminSettings.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = action.payload ?? 'Failed to update admin settings';
      });
  },
});

export const { resetAdminUpdateSettingsState } = adminUpdateSettingsSlice.actions;
export default adminUpdateSettingsSlice.reducer;
