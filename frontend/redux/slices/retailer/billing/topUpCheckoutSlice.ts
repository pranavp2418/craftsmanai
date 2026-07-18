import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface TopUpCheckoutRequest {
  topUpPackId: string;
}

export interface TopUpCheckoutResponse {
  checkout_url: string;
  message?: string;
}

interface TopUpCheckoutState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  checkoutUrl: string | null;
}

const initialState: TopUpCheckoutState = {
  status: 'idle',
  error: null,
  checkoutUrl: null,
};

export const createTopUpCheckoutSession = createAsyncThunk<
  TopUpCheckoutResponse,
  TopUpCheckoutRequest,
  { rejectValue: string }
>('retailer/billing/createTopUpCheckoutSession', async ({ topUpPackId }, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.post(
      '/api/v2/retailer/subscriptions/create-topup-checkout-session',
      undefined,
      {
        params: {
          topup_pack_id: topUpPackId,
        },
      },
    );

    if (response.data && response.data.checkout_url) {
      return response.data as TopUpCheckoutResponse;
    }

    return rejectWithValue('Checkout URL not returned from server.');
  } catch (error: any) {
    return rejectWithValue(formatApiError(error) || 'Failed to create top-up checkout session.');
  }
});

const topUpCheckoutSlice = createSlice({
  name: 'retailerTopUpCheckout',
  initialState,
  reducers: {
    resetTopUpCheckout: (state) => {
      state.status = 'idle';
      state.error = null;
      state.checkoutUrl = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createTopUpCheckoutSession.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(createTopUpCheckoutSession.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.checkoutUrl = action.payload.checkout_url;
      })
      .addCase(createTopUpCheckoutSession.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to create top-up checkout session.';
      });
  },
});

export const { resetTopUpCheckout } = topUpCheckoutSlice.actions;
export default topUpCheckoutSlice.reducer;
