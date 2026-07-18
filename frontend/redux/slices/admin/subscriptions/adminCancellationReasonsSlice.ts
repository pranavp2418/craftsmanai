import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CancellationReasonItem {
  reason: string;
  count: number;
  percentage: number;
}

interface AdminCancellationReasonsState {
  reasons: CancellationReasonItem[];
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminCancellationReasonsState = {
  reasons: [],
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchCancellationReasons = createAsyncThunk<
  { success: boolean; data: CancellationReasonItem[] },
  void,
  { rejectValue: string }
>(
  'adminCancellationReasons/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/admin/subscription-plans/cancellation-insights/reasons');
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch cancellation reasons.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminCancellationReasonsSlice = createSlice({
  name: 'adminCancellationReasons',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCancellationReasons.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCancellationReasons.fulfilled, (state, action) => {
        state.loading = false;
        state.reasons = action.payload.data;
      })
      .addCase(fetchCancellationReasons.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminCancellationReasonsSlice.reducer;
