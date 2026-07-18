import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreatePlanPayload {
  name: string;
  description: string;
  price: number;
  monthly_price: number;
  yearly_price: number;
  duration_days: number;
  is_active: boolean;
  is_most_popular: boolean;
  feature_points: string[];
  monthly_renders: number;
  customer_shares: number;
  manufacturer_quotes: number;
  can_use_logo: boolean;
  can_use_brand_name: boolean;
  can_use_custom_color: boolean;
  has_unlimited_renders: boolean;
}

interface AdminCreatePlanState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminCreatePlanState = {
  loading: false,
  error: null,
  success: false,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const createSubscriptionPlan = createAsyncThunk<
  void,
  CreatePlanPayload,
  { rejectValue: string }
>(
  'adminCreatePlan/create',
  async (payload, { rejectWithValue }) => {
    try {
      await axiosInstance.post('/api/v2/admin/subscription-plans/', payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to create subscription plan.';
      return rejectWithValue(message);
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminCreatePlanSlice = createSlice({
  name: 'adminCreatePlan',
  initialState,
  reducers: {
    resetCreatePlan(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createSubscriptionPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createSubscriptionPlan.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(createSubscriptionPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetCreatePlan } = adminCreatePlanSlice.actions;
export default adminCreatePlanSlice.reducer;
