import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RevenueGrowthPoint {
  month: string;
  revenue: number;
}

interface AdminRevenueGrowthState {
  data: RevenueGrowthPoint[];
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminRevenueGrowthState = {
  data: [],
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchRevenueGrowth = createAsyncThunk<
  RevenueGrowthPoint[],
  void, 
  { rejectValue: string }
>(
  'adminRevenueGrowth/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/admin/subscription-plans/overview/revenue-growth`);
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch revenue growth data.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminRevenueGrowthSlice = createSlice({
  name: 'adminRevenueGrowth',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRevenueGrowth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRevenueGrowth.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchRevenueGrowth.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminRevenueGrowthSlice.reducer;
