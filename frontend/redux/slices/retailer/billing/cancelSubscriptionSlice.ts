import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

interface CancelSubscriptionState {
  sendOtpStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  sendOtpError: string | null;
  sendOtpData: { message?: string } | null;
}

const initialState: CancelSubscriptionState = {
  sendOtpStatus: 'idle',
  sendOtpError: null,
  sendOtpData: null,
};

export const sendCancelSubscriptionOtp = createAsyncThunk<
  { message: string },
  { email: string },
  { rejectValue: string }
>(
  'retailer/billing/sendCancelSubscriptionOtp',
  async ({ email }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        '/api/v2/retailer/subscriptions/cancel/send-otp',
        { email }
      );
      return response.data;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to send cancellation OTP.';
      return rejectWithValue(message);
    }
  }
);

const cancelSubscriptionSlice = createSlice({
  name: 'retailerCancelSubscription',
  initialState,
  reducers: {
    resetCancelSubscriptionState: (state) => {
      state.sendOtpStatus = 'idle';
      state.sendOtpError = null;
      state.sendOtpData = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendCancelSubscriptionOtp.pending, (state) => {
        state.sendOtpStatus = 'loading';
        state.sendOtpError = null;
      })
      .addCase(sendCancelSubscriptionOtp.fulfilled, (state, action) => {
        state.sendOtpStatus = 'succeeded';
        state.sendOtpData = action.payload;
      })
      .addCase(sendCancelSubscriptionOtp.rejected, (state, action) => {
        state.sendOtpStatus = 'failed';
        state.sendOtpError = action.payload || 'Failed to send cancellation OTP.';
      });
  },
});

export const { resetCancelSubscriptionState } = cancelSubscriptionSlice.actions;
export default cancelSubscriptionSlice.reducer;
