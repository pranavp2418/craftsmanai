import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';
import { setAccessToken as setAuthAccessToken } from '../auth/authSlice';
import { setAccessToken as setMemoryAccessToken } from '@/src/utils/auth';
import { fetchUserProfile, resetProfile } from '../retailer/settings/profileSlice';
import { resetLogin } from '../login/loginSlice';
import { setStoredUser } from '@/src/utils/auth';
import { toast } from 'react-toastify';

interface SignupData {
  email: string;
  password: string;
  business_name: string;
  whatsapp_number: string;
  remember_me: boolean;
}

interface DeviceInfo {
  device_type: string;
  device_os: string;
  browser: string;
}

interface VerifyOtpData {
  email: string;
  otp: string;
  remember_me: boolean;
  otp_type?: string;
}

interface SignupResponse {
  success: boolean;
  message: string;
  data?: any;
}

interface VerifyOtpResponse {
  success: boolean;
  message: string;
  email_verified?: boolean;
  tokens?: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };
  data?: any;
}

// Utility function to detect device information
const getDeviceInfo = (): DeviceInfo => {
  const userAgent = typeof window !== 'undefined' ? navigator.userAgent : '';
  
  // Detect OS
  let device_os = 'Unknown';
  if (userAgent.indexOf('Win') !== -1) device_os = 'Windows';
  else if (userAgent.indexOf('Mac') !== -1) device_os = 'MacOS';
  else if (userAgent.indexOf('Linux') !== -1) device_os = 'Linux';
  else if (userAgent.indexOf('Android') !== -1) device_os = 'Android';
  else if (userAgent.indexOf('iOS') !== -1) device_os = 'iOS';
  
  // Detect Browser
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

interface SignupState {
  loading: boolean;
  success: boolean;
  error: string | null;
  message: string | null;
  email: string | null;
  otpLoading: boolean;
  otpVerified: boolean;
  otpError: string | null;
}

const initialState: SignupState = {
  loading: false,
  success: false,
  error: null,
  message: null,
  email: null,
  otpLoading: false,
  otpVerified: false,
  otpError: null,
};

export const signupUser = createAsyncThunk<
  SignupResponse,
  SignupData,
  { rejectValue: string }
>(
  'signup/signupUser',
  async (signupData, { rejectWithValue }) => {
    try {
      const device_info = getDeviceInfo();
      const payload = { ...signupData, device_info };
      const response = await axiosInstance.post('/api/v2/auth/signup', payload, { withCredentials: false });
      toast.success(response.data?.message || 'Signup successful! Please verify your email with OTP.');
      return response.data;
    } catch (error: any) {
      const errorMessage = formatApiError(error) || 'Signup failed. Please try again.';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const verifyOtp = createAsyncThunk<
  VerifyOtpResponse,
  VerifyOtpData,
  { rejectValue: string }
>(
  'signup/verifyOtp',
  async (otpData, { rejectWithValue, dispatch }) => {
    try {
      dispatch(resetProfile());
      dispatch(resetLogin());
      setStoredUser(null);

      // Get device information
      const device_info = getDeviceInfo();

      // Construct request payload with device_info
      const requestPayload = {
        email: otpData.email,
        otp: otpData.otp,
        device_info,
      };

      const url = otpData.otp_type
        ? `/api/v2/auth/verify-otp?otp_type=${otpData.otp_type}`
        : '/api/v2/auth/verify-otp';

      const response = await axiosInstance.post(url, requestPayload, { withCredentials: false });

      // Response may return tokens at top-level or nested under `tokens`
      const data = response.data || {};
      const accessToken = data.access_token || data.tokens?.access_token;
      const refreshToken = data.refresh_token || data.tokens?.refresh_token;

      if (accessToken) {
        dispatch(setAuthAccessToken(accessToken));
        setMemoryAccessToken(accessToken);
      }

      await dispatch(fetchUserProfile());

      toast.success(data.notification_message || data.message || 'OTP verified successfully!');

      return response.data;
    } catch (error: any) {
      const errorMessage = formatApiError(error) || 'OTP verification failed. Please try again.';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

const signupSlice = createSlice({
  name: 'signup',
  initialState,
  reducers: {
    resetSignup: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
      state.message = null;
      state.email = null;
      state.otpLoading = false;
      state.otpVerified = false;
      state.otpError = null;
    },
    setEmail: (state, action: PayloadAction<string>) => {
      state.email = action.payload;
    },
    resetOtpState: (state) => {
      state.otpLoading = false;
      state.otpVerified = false;
      state.otpError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signupUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.message = action.payload.message || 'Signup successful!';
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Signup failed';
        state.success = false;
      })
      .addCase(verifyOtp.pending, (state) => {
        state.otpLoading = true;
        state.otpError = null;
        state.otpVerified = false;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.otpLoading = false;
        state.otpVerified = true;
        state.message = action.payload.message || 'OTP verified successfully!';
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.otpLoading = false;
        state.otpError = action.payload || 'OTP verification failed';
        state.otpVerified = false;
      });
  },
});

export const { resetSignup, setEmail, resetOtpState } = signupSlice.actions;
export default signupSlice.reducer;
