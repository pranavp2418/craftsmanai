import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface UsageInsights {
  totalAIRendersGenerated: number;
  totalCustomerShares: number;
  totalManufacturerQuotes: number;
  avgRendersPerRetailer: number;
}

interface AdminUsageInsightsState {
  data: UsageInsights | null;
  loading: boolean;
  error: string | null;
}

const initialState: AdminUsageInsightsState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchUsageInsights = createAsyncThunk<
  UsageInsights,
  void,
  { rejectValue: string }
>('adminUsageInsights/fetch', async (_, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.get('/api/v2/admin/subscription-plans/usage-insights');
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.detail ||
        error?.message ||
        'Failed to fetch usage insights.',
    );
  }
});

const adminUsageInsightsSlice = createSlice({
  name: 'adminUsageInsights',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsageInsights.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsageInsights.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchUsageInsights.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminUsageInsightsSlice.reducer;
