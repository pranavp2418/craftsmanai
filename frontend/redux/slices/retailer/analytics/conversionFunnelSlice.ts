import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface FunnelStage {
  label: string;
  count: number | null | undefined;
  rate: number | null | undefined;
}

export interface FunnelSummary {
  avg_time_to_approval_days: number | null | undefined;
  avg_refinements_per_design: number | null | undefined;
  conversion_rate: number | null | undefined;
}

export interface ConversionFunnelResponse {
  stages: FunnelStage[];
  summary: FunnelSummary;
}

interface ConversionFunnelState {
  data: ConversionFunnelResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: ConversionFunnelState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchConversionFunnelAnalytics = createAsyncThunk<
  ConversionFunnelResponse,
  void,
  { rejectValue: string }
>(
  'retailer/analytics/conversionFunnel/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/analytics/conversion-funnel');
      return response.data as ConversionFunnelResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to fetch conversion funnel metrics.';
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { loading } = state.retailerAnalyticsConversionFunnel;
      if (loading) {
        return false;
      }
    },
  }
);

const conversionFunnelSlice = createSlice({
  name: 'retailerAnalyticsConversionFunnel',
  initialState,
  reducers: {
    resetConversionFunnelAnalytics(state) {
      state.data = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversionFunnelAnalytics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchConversionFunnelAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchConversionFunnelAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetConversionFunnelAnalytics } = conversionFunnelSlice.actions;
export default conversionFunnelSlice.reducer;
