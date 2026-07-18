import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';
import { setAccessToken as setAuthAccessToken } from '../auth/authSlice';
import { setAccessToken as setStoredAccessToken, setStoredUser } from '@/src/utils/auth';
import { toast } from 'react-toastify';

interface DeviceInfo {
  device_type: string;
  device_os: string;
  browser: string;
}

interface LoginData {
  email: string;
  password: string;
  remember_me: boolean;
  device_info: DeviceInfo;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  id?: string;
  user_id: string;
  is_superuser: boolean;
  email: string;
  username: string;
  full_name?: string | null;
  email_verified: boolean;
  notification_message: string;
  profile_image_url?: string;
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

interface LoginState {
  loading: boolean;
  success: boolean;
  error: string | null;
  user: LoginResponse | null;
  twoFactorRequired: boolean;
}

const initialState: LoginState = {
  loading: false,
  success: false,
  error: null,
  user: null,
  twoFactorRequired: false,
};

export const loginUser = createAsyncThunk<
  LoginResponse,
  { email: string; password: string; remember_me: boolean },
  { rejectValue: any }
>(
  'login/loginUser',
  async (credentials, { rejectWithValue, dispatch }) => {
    try {
      const device_info = getDeviceInfo();
      
      const loginData: LoginData = {
        ...credentials,
        device_info,
      };
      
      const response = await axiosInstance.post('/api/v2/auth/login', loginData, { withCredentials: true });

      dispatch(setAuthAccessToken(response.data.access_token));
      setStoredAccessToken(response.data.access_token);
      setStoredUser(response.data);

      toast.success(response.data.notification_message || response.data.message || 'Login successful!');
      
      return response.data;
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail && detail.code === 'TWO_FACTOR_REQUIRED') {
        return rejectWithValue({
          code: 'TWO_FACTOR_REQUIRED',
          message: detail.message || 'OTP verification required',
        });
      }
      const errorMessage = formatApiError(error) || 'Login failed. Please check your credentials.';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

const loginSlice = createSlice({
  name: 'login',
  initialState,
  reducers: {
    resetLoginStatus: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
      state.twoFactorRequired = false;
    },
    resetLogin: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
      state.user = null;
      state.twoFactorRequired = false;
    },
    logout: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
      state.user = null;
      state.twoFactorRequired = false;
    },
    setUser: (state, action: PayloadAction<LoginResponse | null>) => {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
        state.twoFactorRequired = false;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.user = action.payload;
        state.twoFactorRequired = false;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        const payload = action.payload as any;
        if (payload && payload.code === 'TWO_FACTOR_REQUIRED') {
          state.twoFactorRequired = true;
          state.error = null;
        } else {
          state.error = payload || 'Login failed';
          state.twoFactorRequired = false;
        }
        state.success = false;
      });
  },
});

export const { resetLogin, resetLoginStatus, logout, setUser } = loginSlice.actions;
export default loginSlice.reducer;
