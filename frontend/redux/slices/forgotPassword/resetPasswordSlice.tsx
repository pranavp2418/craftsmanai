import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import { toast } from 'react-toastify';
import formatApiError from '@/src/utils/formatApiError';

interface ResetPasswordData {
  email: string;
  token: string;
  new_password: string;
}

interface ResetPasswordResponse {
  success: boolean;
  message: string;
  data?: any;
}

interface ResetPasswordState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: ResetPasswordState = {
  loading: false,
  error: null,
  success: false,
};

// Async thunk for confirming password reset
export const confirmPasswordReset = createAsyncThunk<
  ResetPasswordResponse,
  ResetPasswordData,
  { rejectValue: string }
>(
  'resetPassword/confirm',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post<ResetPasswordResponse>(
        '/api/v2/auth/verify-password-reset',
        data,
        { withCredentials: false }
      );

      // Show success toast from the slice
      toast.success(response.data.message || 'Password reset successful!');

      return response.data;
    } catch (error: any) {
      const errorMessage = formatApiError(error) || 'Failed to reset password. Please try again.';

      // Show error toast from the slice
      toast.error(errorMessage);

      return rejectWithValue(errorMessage);
    }
  }
);

const resetPasswordSlice = createSlice({
  name: 'resetPassword',
  initialState,
  reducers: {
    resetPasswordState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(confirmPasswordReset.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(confirmPasswordReset.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.error = null;
      })
      .addCase(confirmPasswordReset.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to reset password';
        state.success = false;
      });
  },
});

export const { resetPasswordState } = resetPasswordSlice.actions;
export default resetPasswordSlice.reducer;
