import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CancellationSummaryData {
  totalCancellations: number;
  churnRate: number;
  avgTenure: number;
  keyInsight: {
    primary: string;
    secondary: string;
  };
}

interface AdminCancellationSummaryState {
  data: CancellationSummaryData | null;
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminCancellationSummaryState = {
  data: null,
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchCancellationSummary = createAsyncThunk<
  { success: boolean; data: CancellationSummaryData },
  void,
  { rejectValue: string }
>(
  'adminCancellationSummary/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/admin/subscription-plans/cancellation-insights/summary');
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch cancellation insights summary.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminCancellationSummarySlice = createSlice({
  name: 'adminCancellationSummary',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCancellationSummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCancellationSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload.data;
      })
      .addCase(fetchCancellationSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminCancellationSummarySlice.reducer;
