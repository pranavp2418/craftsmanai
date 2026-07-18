import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import { toast } from 'react-toastify';
import formatApiError from '@/src/utils/formatApiError';
import { clearAuth } from '../auth/authSlice';
import { setAccessToken as setStoredAccessToken, setStoredUser, clearAllClientStorage } from '@/src/utils/auth';
import { logout as clearLoginUser } from '../login/loginSlice';
import { resetProfile } from '../retailer/settings/profileSlice';
import { resetAppearance } from '../retailer/settings/appearanceSlice';
import { resetSignup, resetOtpState } from '../signup/signupSlice';

interface LogoutState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

const initialState: LogoutState = {
  loading: false,
  success: false,
  error: null,
};

export const logoutUser = createAsyncThunk<
  { message: string },
  void,
  { rejectValue: string }
>(
  'logout/logoutUser',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const response = await axiosInstance.post('/api/v2/auth/logout');

      // Clear auth data after successful logout

      dispatch(clearAuth());
      dispatch(clearLoginUser());
      dispatch(resetProfile());
      dispatch(resetAppearance());
      dispatch(resetSignup());
      dispatch(resetOtpState());
      setStoredAccessToken(null);
      setStoredUser(null);
      clearAllClientStorage();

      // Show success toast
      toast.success(response.data?.message || 'Logged out successfully!');

      return response.data;
    } catch (error: any) {
      // Clear auth data even on error to ensure user is logged out

      dispatch(clearAuth());
      dispatch(clearLoginUser());
      dispatch(resetProfile());
      dispatch(resetAppearance());
      dispatch(resetSignup());
      dispatch(resetOtpState());
      setStoredAccessToken(null);
      setStoredUser(null);
      clearAllClientStorage();

      const errorMessage = formatApiError(error) || 'Logout failed. Please try again.';

      // Show error toast
      toast.error(errorMessage);

      return rejectWithValue(errorMessage);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as { logout: LogoutState };
      return !state.logout.loading;
    },
    dispatchConditionRejection: true,
  }
);

const logoutSlice = createSlice({
  name: 'logout',
  initialState,
  reducers: {
    resetLogout: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Logout failed';
        state.success = false;
      });
  },
});

export const { resetLogout } = logoutSlice.actions;
export default logoutSlice.reducer;
