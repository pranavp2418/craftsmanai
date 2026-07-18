import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubscriptionGrowthPoint {
  month: string;
  new: number;
  churned: number;
}

interface AdminSubscriptionGrowthState {
  data: SubscriptionGrowthPoint[];
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminSubscriptionGrowthState = {
  data: [],
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchSubscriptionGrowth = createAsyncThunk<
  SubscriptionGrowthPoint[],
  void, 
  { rejectValue: string }
>(
  'adminSubscriptionGrowth/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/admin/subscription-plans/overview/subscription-growth`);
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch subscription growth data.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminSubscriptionGrowthSlice = createSlice({
  name: 'adminSubscriptionGrowth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubscriptionGrowth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSubscriptionGrowth.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchSubscriptionGrowth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminSubscriptionGrowthSlice.reducer;
