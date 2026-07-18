import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

interface CancelPlanState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  data: { message?: string } | null;
}

const initialState: CancelPlanState = {
  status: 'idle',
  error: null,
  data: null,
};

export const cancelSubscriptionPlan = createAsyncThunk<
  { message: string },
  { cancellation_reason: string },
  { rejectValue: string }
>(
  'retailer/billing/cancelSubscriptionPlan',
  async ({ cancellation_reason }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        '/api/v2/retailer/subscriptions/cancel',
        { cancellation_reason }
      );
      return response.data;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to cancel subscription.';
      return rejectWithValue(message);
    }
  }
);

const cancelPlanSlice = createSlice({
  name: 'retailerCancelPlan',
  initialState,
  reducers: {
    resetCancelPlanState: (state) => {
      state.status = 'idle';
      state.error = null;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(cancelSubscriptionPlan.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(cancelSubscriptionPlan.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(cancelSubscriptionPlan.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to cancel subscription.';
      });
  },
});

export const { resetCancelPlanState } = cancelPlanSlice.actions;
export default cancelPlanSlice.reducer;
