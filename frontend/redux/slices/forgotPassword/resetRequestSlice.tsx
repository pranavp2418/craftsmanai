import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';
import { toast } from 'react-toastify';

interface ResetRequestData {
  email: string;
}

interface ResetRequestResponse {
  success: boolean;
  message: string;
  data?: any;
}

interface ResetRequestState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: ResetRequestState = {
  loading: false,
  error: null,
  success: false,
};

// Async thunk for requesting password reset
export const requestPasswordReset = createAsyncThunk<
  ResetRequestResponse,
  ResetRequestData,
  { rejectValue: string }
>(
  'resetRequest/request',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post<ResetRequestResponse>(
        '/api/v2/auth/password-reset',
        data,
        { withCredentials: false }
      );

      // Show success toast from the slice
      toast.success(response.data.message || 'Password reset link sent successfully!');

      return response.data;
    } catch (error: any) {
      const errorMessage = formatApiError(error) || 'Failed to send reset link. Please try again.';

      // Show error toast from the slice
      toast.error(errorMessage);

      return rejectWithValue(errorMessage);
    }
  }
);

const resetRequestSlice = createSlice({
  name: 'resetRequest',
  initialState,
  reducers: {
    resetRequestState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(requestPasswordReset.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.error = null;
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to send reset link';
        state.success = false;
      });
  },
});

export const { resetRequestState } = resetRequestSlice.actions;
export default resetRequestSlice.reducer;
