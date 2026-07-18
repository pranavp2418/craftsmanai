import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanDistributionPoint {
  plan: string;
  retailers: number;
  percentage: number;
}

interface AdminPlanDistributionState {
  data: PlanDistributionPoint[];
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminPlanDistributionState = {
  data: [],
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchPlanDistribution = createAsyncThunk<
  PlanDistributionPoint[],
  void, 
  { rejectValue: string }
>(
  'adminPlanDistribution/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/admin/subscription-plans/overview/plan-distribution`);
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch plan distribution data.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminPlanDistributionSlice = createSlice({
  name: 'adminPlanDistribution',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlanDistribution.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlanDistribution.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchPlanDistribution.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminPlanDistributionSlice.reducer;
