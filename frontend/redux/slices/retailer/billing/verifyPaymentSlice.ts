import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface VerifyPaymentResponse {
  status: string;
  message: string;
  amount: number;
  payment_method: string;
  transaction_id: string;
  plan_name: string;
}

interface VerifyPaymentState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  data: VerifyPaymentResponse | null;
}

const initialState: VerifyPaymentState = {
  status: 'idle',
  error: null,
  data: null,
};

export const verifyPayment = createAsyncThunk<VerifyPaymentResponse, string, { rejectValue: string }>(
  'retailer/billing/verifyPayment',
  async (sessionId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/retailer/subscriptions/verify-payment/${sessionId}`);
      if (response.data) {
        return response.data as VerifyPaymentResponse;
      }
      return rejectWithValue('Failed to verify payment.');
    } catch (error: any) {
      return rejectWithValue(formatApiError(error) || 'Failed to verify payment.');
    }
  }
);

const verifyPaymentSlice = createSlice({
  name: 'retailerVerifyPayment',
  initialState,
  reducers: {
    resetVerifyPayment: (state) => {
      state.status = 'idle';
      state.error = null;
      state.data = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(verifyPayment.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(verifyPayment.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(verifyPayment.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to verify payment.';
      });
  },
});

export const { resetVerifyPayment } = verifyPaymentSlice.actions;
export default verifyPaymentSlice.reducer;
