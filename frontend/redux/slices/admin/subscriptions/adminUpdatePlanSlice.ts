import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import { CreatePlanPayload } from './adminCreatePlanSlice';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUpdatePlanState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminUpdatePlanState = {
  loading: false,
  error: null,
  success: false,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const updateSubscriptionPlan = createAsyncThunk<
  void,
  { plan_id: string; payload: CreatePlanPayload },
  { rejectValue: string }
>(
  'adminUpdatePlan/update',
  async ({ plan_id, payload }, { rejectWithValue }) => {
    try {
      await axiosInstance.put(`/api/v2/admin/subscription-plans/${plan_id}`, payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to update subscription plan.';
      return rejectWithValue(message);
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminUpdatePlanSlice = createSlice({
  name: 'adminUpdatePlan',
  initialState,
  reducers: {
    resetUpdatePlan(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateSubscriptionPlan.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(updateSubscriptionPlan.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(updateSubscriptionPlan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetUpdatePlan } = adminUpdatePlanSlice.actions;
export default adminUpdatePlanSlice.reducer;
