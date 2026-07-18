import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityLogItem {
  id: string;
  event_type: string;
  retailer_name: string;
  retailer_id_str: string;
  plan_name: string;
  old_plan_name: string | null;
  triggered_by: string;
  triggered_by_name: string | null;
  created_at: string;
}

interface AdminSubscriptionActivityLogsState {
  logs: ActivityLogItem[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminSubscriptionActivityLogsState = {
  logs: [],
  total: 0,
  page: 1,
  totalPages: 0,
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchSubscriptionActivityLogs = createAsyncThunk<
  { success: boolean; data: ActivityLogItem[]; total: number; page: number; total_pages: number },
  { page?: number; search?: string; event_type?: string; limit?: number },
  { rejectValue: string }
>(
  'adminSubscriptionActivityLogs/fetch',
  async (params, { rejectWithValue }) => {
    try {
      const apiParams: any = {
        page: params.page || 1,
        limit: params.limit || 10,
        search: params.search || '',
      };
      if (params?.event_type && params.event_type !== 'All Events') {
        apiParams.event_type = params.event_type;
      }
      const response = await axiosInstance.get('/api/v2/admin/subscription-plans/activity-logs/', {
        params: apiParams
      });
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch activity logs.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminSubscriptionActivityLogsSlice = createSlice({
  name: 'adminSubscriptionActivityLogs',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubscriptionActivityLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSubscriptionActivityLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.logs = action.payload.data;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.totalPages = action.payload.total_pages;
        state.error = null;
      })
      .addCase(fetchSubscriptionActivityLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminSubscriptionActivityLogsSlice.reducer;
