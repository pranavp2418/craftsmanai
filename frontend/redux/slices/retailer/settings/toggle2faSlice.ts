import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface Toggle2FAPayload {
  enable_2fa: boolean;
}

interface Toggle2FAState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  is2FAEnabled: boolean;
  fetchStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  fetchError: string | null;
}

const initialState: Toggle2FAState = {
  status: 'idle',
  error: null,
  is2FAEnabled: false,
  fetchStatus: 'idle',
  fetchError: null,
};

export const fetch2FAStatus = createAsyncThunk<
  { is_2fa_enabled: boolean },
  void,
  { rejectValue: string }
>('retailer/settings/fetch2FAStatus', async (_, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.get('/api/v2/user-profile/2fa-status');
    return response.data;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to fetch 2FA status.';
    return rejectWithValue(message);
  }
},
{
  condition: (_, { getState }) => {
    const state = getState() as any;
    const { fetchStatus } = state.retailerToggle2FA;
    if (fetchStatus === 'loading') {
      return false;
    }
  },
});

export const toggle2FA = createAsyncThunk<
  any,
  Toggle2FAPayload,
  { rejectValue: string }
>('retailer/settings/toggle2FA', async (payload, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.post('/api/v2/user-profile/toggle-2fa', payload);
    return response.data;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to toggle 2FA.';
    return rejectWithValue(message);
  }
});

const toggle2faSlice = createSlice({
  name: 'toggle2fa',
  initialState,
  reducers: {
    resetToggle2FAState: (state) => {
      state.status = 'idle';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(toggle2FA.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(toggle2FA.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.is2FAEnabled = action.meta.arg.enable_2fa;
      })
      .addCase(toggle2FA.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to toggle 2FA.';
      })
      .addCase(fetch2FAStatus.pending, (state) => {
        state.fetchStatus = 'loading';
        state.fetchError = null;
      })
      .addCase(fetch2FAStatus.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        state.is2FAEnabled = action.payload.is_2fa_enabled;
      })
      .addCase(fetch2FAStatus.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.fetchError = action.payload || 'Failed to fetch 2FA status.';
      });
  },
});

export const { resetToggle2FAState } = toggle2faSlice.actions;

export default toggle2faSlice.reducer;
