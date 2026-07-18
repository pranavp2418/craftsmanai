import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';
import { toast } from 'react-toastify';

interface ResendOtpData {
  email: string;
}

interface ResendOtpResponse {
  success: boolean;
  message: string;
  data?: any;
}

interface ResendOtpState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: ResendOtpState = {
  loading: false,
  error: null,
  success: false,
};

// Async thunk for resending OTP
export const resendOtp = createAsyncThunk<
  ResendOtpResponse,
  ResendOtpData,
  { rejectValue: string }
>(
  'resendOtp/resend',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post<ResendOtpResponse>(
        '/api/v2/auth/resend-otp',
        data
      );

      // Show success toast from the slice
      toast.success(response.data.message || 'OTP resent successfully!');

      return response.data;
    } catch (error: any) {
      const errorMessage = formatApiError(error) || 'Failed to resend OTP. Please try again.';

      // Show error toast from the slice
      toast.error(errorMessage);

      return rejectWithValue(errorMessage);
    }
  }
);

const resendOtpSlice = createSlice({
  name: 'resendOtp',
  initialState,
  reducers: {
    resetResendOtp: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(resendOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(resendOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.error = null;
      })
      .addCase(resendOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to resend OTP';
        state.success = false;
      });
  },
});

export const { resetResendOtp } = resendOtpSlice.actions;
export default resendOtpSlice.reducer;
