import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { setAccessToken as setStoredAccessToken } from '@/src/utils/auth';

interface AuthState {
  accessToken: string | null;
  refreshStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  refreshError: string | null;
  isInitialized: boolean;
}

const initialState: AuthState = {
  accessToken: null,
  refreshStatus: 'idle',
  refreshError: null,
  isInitialized: false,
};

export const refreshAccessToken = createAsyncThunk<
  { access_token: string },
  void,
  { rejectValue: string }
>('auth/refreshAccessToken', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL || ''}/api/v2/auth/refresh-token`,
      {},
      { withCredentials: true }
    );

    const token = response.data?.access_token;
    if (!token) {
      return rejectWithValue('Missing access token in refresh response');
    }

    setStoredAccessToken(token);
    return { access_token: token };
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      error?.response?.data?.detail ||
      error?.message ||
      'Refresh token failed';
    return rejectWithValue(message);
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
    },
    setInitialized: (state, action: PayloadAction<boolean>) => {
      state.isInitialized = action.payload;
    },
    clearAuth: (state) => {
      state.accessToken = null;
      state.refreshStatus = 'idle';
      state.refreshError = null;
      state.isInitialized = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(refreshAccessToken.pending, (state) => {
        state.refreshStatus = 'loading';
        state.refreshError = null;
      })
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.refreshStatus = 'succeeded';
        state.accessToken = action.payload.access_token;
        state.isInitialized = true;
      })
      .addCase(refreshAccessToken.rejected, (state, action) => {
        state.refreshStatus = 'failed';
        state.refreshError = action.payload || 'Refresh token failed';
        state.accessToken = null;
        state.isInitialized = true;
      })
      .addCase('login/loginUser/fulfilled', (state, action: any) => {
        state.accessToken = action.payload?.access_token || null;
        state.isInitialized = true;
      })
      .addMatcher(
        (action) =>
          action.type === 'auth/clearAuth' ||
          action.type === 'login/logout' ||
          action.type === 'logout/logoutUser/fulfilled',
        (state) => {
          state.accessToken = null;
          state.isInitialized = true;
        }
      );
  },
});

export const { setAccessToken, clearAuth, setInitialized } = authSlice.actions;
export default authSlice.reducer;
