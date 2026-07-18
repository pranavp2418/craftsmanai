import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubscriptionStats {
  mrr: number;
  arr: number;
  active_subscriptions: number;
  new_subscriptions: number;
  churn_rate: number;
  total_revenue: number;
  trends: {
    mrr: number;
    arr: number;
    active_subscriptions: number;
    new_subscriptions: number;
    churn_rate: number;
    total_revenue: number;
  };
}

interface AdminSubscriptionStatsState {
  stats: SubscriptionStats | null;
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminSubscriptionStatsState = {
  stats: null,
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchSubscriptionStats = createAsyncThunk<
  SubscriptionStats,
  string, // period
  { rejectValue: string }
>(
  'adminSubscriptionStats/fetch',
  async (period, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/admin/subscription-plans/overview/stats`, {
        params: { period }
      });
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch subscription stats.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminSubscriptionStatsSlice = createSlice({
  name: 'adminSubscriptionStats',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubscriptionStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSubscriptionStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchSubscriptionStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminSubscriptionStatsSlice.reducer;
