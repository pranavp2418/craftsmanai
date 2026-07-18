import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface AdminSettings {
  id: number;
  default_currency: string;
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
  default_request_status: string;
  updated_at: string;
}

interface AdminSettingsState {
  data: AdminSettings | null;
  loading: boolean;
  error: string | null;
}

const initialState: AdminSettingsState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchAdminSettings = createAsyncThunk<
  AdminSettings,
  void,
  { rejectValue: string }
>(
  'admin/settings/fetchAdminSettings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/admin/settings/');
      const raw = response.data?.data ?? response.data;

      return {
        id: Number(raw?.id ?? 0),
        default_currency: String(raw?.default_currency ?? 'USD'),
        default_lead_time_unit: String(raw?.default_lead_time_unit ?? 'DAYS'),
        ai_provider: String(raw?.ai_provider ?? 'GPT_4'),
        retry_limit: Number(raw?.retry_limit ?? 3),
        timeout_seconds: Number(raw?.timeout_seconds ?? 30),
        link_expiry_days: Number(raw?.link_expiry_days ?? 7),
        ai_image_detection: Boolean(raw?.ai_image_detection ?? true),
        guided_visual_quiz: Boolean(raw?.guided_visual_quiz ?? true),
        prompt_only_flow: Boolean(raw?.prompt_only_flow ?? false),
        manufacturer_notifications: Boolean(raw?.manufacturer_notifications ?? true),
        email_notifications: Boolean(raw?.email_notifications ?? true),
        in_app_notifications: Boolean(raw?.in_app_notifications ?? true),
        default_request_status: String(raw?.default_request_status ?? 'PENDING_DETECTION'),
        updated_at: String(raw?.updated_at ?? ''),
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      return rejectWithValue(
        err.response?.data?.detail ??
          err.response?.data?.message ??
          err.message ??
          'Failed to fetch admin settings'
      );
    }
  }
);

const adminSettingsSlice = createSlice({
  name: 'adminSettings',
  initialState,
  reducers: {
    resetAdminSettingsState: (state) => {
      state.data = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchAdminSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch admin settings';
      });
  },
});

export const { resetAdminSettingsState } = adminSettingsSlice.actions;
export default adminSettingsSlice.reducer;
