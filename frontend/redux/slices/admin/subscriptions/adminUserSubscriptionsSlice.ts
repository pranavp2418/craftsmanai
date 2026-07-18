import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UsageData {
  renders_used: number;
  renders_total: number;
  renders_remaining: number;
  topup_renders: number;
}

export interface UserSubscription {
  id: string;
  user_id: number;
  user_name: string;
  email: string;
  business_name: string;
  plan_id: string;
  plan_name: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
  usage?: UsageData;
}

interface AdminUserSubscriptionsState {
  subscriptions: UserSubscription[];
  total: number;
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminUserSubscriptionsState = {
  subscriptions: [],
  total: 0,
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchUserSubscriptions = createAsyncThunk<
  { success: boolean; data: UserSubscription[]; total: number },
  { search?: string; status?: string; skip?: number; limit?: number } | void,
  { rejectValue: string }
>(
  'adminUserSubscriptions/fetch',
  async (arg, { rejectWithValue }) => {
    try {
      const params: Record<string, any> = {};
      if (arg) {
        const { search, status, skip, limit } = arg;
        if (search) params.search = search;
        if (status) params.status = status;
        if (skip !== undefined) params.skip = skip;
        if (limit !== undefined) params.limit = limit;
      }
      const response = await axiosInstance.get('/api/v2/admin/subscription-plans/user-subscriptions/', { params });
      // Handle different possible backend response formats
      if (response.data && Array.isArray(response.data)) {
        return { success: true, data: response.data, total: response.data.length };
      }
      if (response.data && Array.isArray(response.data.data)) {
        return response.data;
      }
      return { success: true, data: response.data || [], total: (response.data || []).length };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch user subscriptions.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminUserSubscriptionsSlice = createSlice({
  name: 'adminUserSubscriptions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserSubscriptions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserSubscriptions.fulfilled, (state, action) => {
        state.loading = false;
        state.subscriptions = action.payload.data;
        state.total = action.payload.total;
      })
      .addCase(fetchUserSubscriptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminUserSubscriptionsSlice.reducer;
