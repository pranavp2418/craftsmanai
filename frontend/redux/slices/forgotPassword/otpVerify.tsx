import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import { toast } from 'react-toastify';
import formatApiError from '@/src/utils/formatApiError';

interface VerifyOtpData {
  email: string;
  otp: string;
  otp_type?: string;
}

interface DeviceInfo {
  device_type: string;
  device_os: string;
  browser: string;
}

interface VerifyOtpResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  user_id?: string;
  email?: string;
  username?: string;
  is_superuser?: boolean;
  is_verified?: boolean;
  notification_message?: string;
  profile_image_url?: string;
  message?: string;
}

interface VerifyOtpState {
  loading: boolean;
  error: string | null;
  success: boolean;
  resetToken: string | null;
}

const initialState: VerifyOtpState = {
  loading: false,
  error: null,
  success: false,
  resetToken: null,
};

const getDeviceInfo = (): DeviceInfo => {
  const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';

  let device_os = 'Unknown';
  if (userAgent.indexOf('Win') !== -1) device_os = 'Windows';
  else if (userAgent.indexOf('Mac') !== -1) device_os = 'MacOS';
  else if (userAgent.indexOf('Linux') !== -1) device_os = 'Linux';
  else if (userAgent.indexOf('Android') !== -1) device_os = 'Android';
  else if (userAgent.indexOf('iOS') !== -1) device_os = 'iOS';

  let browser = 'Unknown';
  if (userAgent.indexOf('Edg') !== -1) browser = 'Edge';
  else if (userAgent.indexOf('Chrome') !== -1) browser = 'Chrome';
  else if (userAgent.indexOf('Safari') !== -1) browser = 'Safari';
  else if (userAgent.indexOf('Firefox') !== -1) browser = 'Firefox';
  else if (userAgent.indexOf('Opera') !== -1 || userAgent.indexOf('OPR') !== -1) browser = 'Opera';

  return {
    device_type: 'Web',
    device_os,
    browser,
  };
};

// Async thunk for verifying OTP
export const verifyResetPasswordOtp = createAsyncThunk<
  VerifyOtpResponse,
  VerifyOtpData,
  { rejectValue: string }
>(
  'otpVerify/verify',
  async (data, { rejectWithValue }) => {
    try {
      const { otp_type = 'password_reset', ...rest } = data;
      const payload = { ...rest, device_info: getDeviceInfo() };
      const response = await axiosInstance.post<VerifyOtpResponse>(
        `/api/v2/auth/verify-otp?otp_type=${otp_type}`,
        payload,
        { withCredentials: false }
      );

      // Show success toast from the slice
      toast.success(response.data.message || 'OTP verified successfully!');

      return response.data;
    } catch (error: any) {
      const errorMessage = formatApiError(error) || 'Failed to verify OTP. Please try again.';

      // Show error toast from the slice
      toast.error(errorMessage);

      return rejectWithValue(errorMessage);
    }
  }
);

const otpVerifySlice = createSlice({
  name: 'otpVerify',
  initialState,
  reducers: {
    resetOtpVerifyState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.resetToken = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(verifyResetPasswordOtp.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(verifyResetPasswordOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.error = null;
        state.resetToken = action.payload.access_token || null;
      })
      .addCase(verifyResetPasswordOtp.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to verify OTP';
        state.success = false;
      });
  },
});

export const { resetOtpVerifyState } = otpVerifySlice.actions;
export default otpVerifySlice.reducer;
