import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface ActivityMetrics {
  total_renders: number | null | undefined;
  designs_sent: number | null | undefined;
  approval_rate: number | null | undefined;
  Active_requests: number | null | undefined;
}

export interface ConversionMetrics {
  total_refinements: number | null | undefined;
  customer_engagement: number | null | undefined;
  manufacturers_engaged: number | null | undefined;
  archived_completed: number | null | undefined;
}

export interface AnalyticsMetricsResponse {
  Activity_metrics: ActivityMetrics;
  conversion_metrics: ConversionMetrics;
}

interface AnalyticsMetricsState {
  data: AnalyticsMetricsResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: AnalyticsMetricsState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchAnalyticsMetrics = createAsyncThunk<
  AnalyticsMetricsResponse,
  void,
  { rejectValue: string }
>(
  'retailer/analytics/metrics/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/analytics/metrics');
      return response.data as AnalyticsMetricsResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to fetch analytics metrics.';
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { loading } = state.retailerAnalyticsMetrics;
      if (loading) {
        return false;
      }
    },
  }
);

const metricsSlice = createSlice({
  name: 'retailerAnalyticsMetrics',
  initialState,
  reducers: {
    resetAnalyticsMetrics(state) {
      state.data = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalyticsMetrics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsMetrics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchAnalyticsMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetAnalyticsMetrics } = metricsSlice.actions;
export default metricsSlice.reducer;
