import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CancellationTrendItem {
  month: string;
  count: number;
  year: number;
}

interface AdminCancellationTrendsState {
  trends: CancellationTrendItem[];
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminCancellationTrendsState = {
  trends: [],
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchCancellationTrends = createAsyncThunk<
  { success: boolean; data: CancellationTrendItem[] },
  void,
  { rejectValue: string }
>(
  'adminCancellationTrends/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/admin/subscription-plans/cancellation-insights/trends');
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch cancellation trends.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminCancellationTrendsSlice = createSlice({
  name: 'adminCancellationTrends',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCancellationTrends.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCancellationTrends.fulfilled, (state, action) => {
        state.loading = false;
        state.trends = action.payload.data;
      })
      .addCase(fetchCancellationTrends.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminCancellationTrendsSlice.reducer;
