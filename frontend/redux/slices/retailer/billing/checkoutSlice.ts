import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface CheckoutSessionRequest {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
}

export interface CheckoutSessionResponse {
  checkout_url: string;
}

interface CheckoutState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  checkoutUrl: string | null;
}

const initialState: CheckoutState = {
  status: 'idle',
  error: null,
  checkoutUrl: null,
};

export const createCheckoutSession = createAsyncThunk<CheckoutSessionResponse, CheckoutSessionRequest, { rejectValue: string }>(
  'retailer/billing/createCheckoutSession',
  async ({ planId, billingCycle }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        `/api/v2/retailer/subscriptions/create-checkout-session?billing_cycle=${billingCycle}&plan_id=${planId}`,
        { plan_id: planId, billing_cycle: billingCycle }
      );
      if (response.data && response.data.checkout_url) {
        return response.data as CheckoutSessionResponse;
      }
      return rejectWithValue('Checkout URL not returned from server.');
    } catch (error: any) {
      return rejectWithValue(formatApiError(error) || 'Failed to create checkout session.');
    }
  }
);

const checkoutSlice = createSlice({
  name: 'retailerCheckout',
  initialState,
  reducers: {
    resetCheckout: (state) => {
      state.status = 'idle';
      state.error = null;
      state.checkoutUrl = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(createCheckoutSession.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createCheckoutSession.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.checkoutUrl = action.payload.checkout_url;
      })
      .addCase(createCheckoutSession.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to create checkout session.';
      });
  },
});

export const { resetCheckout } = checkoutSlice.actions;
export default checkoutSlice.reducer;
