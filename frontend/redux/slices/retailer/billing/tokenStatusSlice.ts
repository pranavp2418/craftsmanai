import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface TokenStatusData {
  monthly_renders_used: number;
  monthly_renders_limit: number;
  topup_renders: number;
  monthly_renders_remaining: number;
  is_unlimited: boolean;
  renders_reset_date: string | null;
  needs_reset: boolean;
  active_subscription: string | null;
}

export interface TokenStatusResponse {
  status: string;
  data: TokenStatusData;
}

interface TokenStatusState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  data: TokenStatusData | null;
}

const initialState: TokenStatusState = {
  status: 'idle',
  error: null,
  data: null,
};

export const fetchTokenStatus = createAsyncThunk<TokenStatusData, void, { rejectValue: string }>(
  'retailer/billing/fetchTokenStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/retailer/subscriptions/token-status');
      // The API response format is: { status: "success", data: { ... } }
      if (response.data && response.data.status === 'success' && response.data.data) {
        return response.data.data as TokenStatusData;
      }
      // Fallback in case data is directly returned or structure differs slightly
      if (response.data && response.data.monthly_renders_used !== undefined) {
        return response.data as unknown as TokenStatusData;
      }
      return rejectWithValue('Invalid token status response format.');
    } catch (error: any) {
      return rejectWithValue(formatApiError(error) || 'Failed to load token status.');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { status } = state.retailerTokenStatus;
      if (status === 'loading') {
        return false;
      }
    },
  }
);

const tokenStatusSlice = createSlice({
  name: 'retailerTokenStatus',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTokenStatus.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchTokenStatus.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchTokenStatus.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load token status.';
      });
  },
});

export default tokenStatusSlice.reducer;
