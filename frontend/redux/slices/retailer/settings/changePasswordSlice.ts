import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';
import { toast } from 'react-toastify';

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
}

interface ChangePasswordState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: ChangePasswordState = {
  status: 'idle',
  error: null,
};

export const changePassword = createAsyncThunk<
  any,
  ChangePasswordPayload,
  { rejectValue: string }
>('retailer/settings/changePassword', async (payload, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.post('/api/v2/user-profile/change-password', payload);
    const message = response.data?.message || 'Password updated successfully';
    toast.success(message);
    return response.data;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to change password.';
    return rejectWithValue(message);
  }
});

const changePasswordSlice = createSlice({
  name: 'changePassword',
  initialState,
  reducers: {
    resetChangePasswordState: (state) => {
      state.status = 'idle';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(changePassword.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.status = 'succeeded';
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to change password.';
      });
  },
});

export const { resetChangePasswordState } = changePasswordSlice.actions;

export default changePasswordSlice.reducer;
