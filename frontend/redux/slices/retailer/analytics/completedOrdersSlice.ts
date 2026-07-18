import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface MonthOrderVolume {
  month: string;
  year: number;
  count: number | null | undefined;
}

export interface CompletedOrdersResponse {
  total_completed_orders: number | null | undefined;
  months: MonthOrderVolume[];
}

interface CompletedOrdersState {
  data: CompletedOrdersResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: CompletedOrdersState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchCompletedOrdersAnalytics = createAsyncThunk<
  CompletedOrdersResponse,
  void,
  { rejectValue: string }
>(
  'retailer/analytics/completedOrders/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/analytics/completed-orders');
      return response.data as CompletedOrdersResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to fetch monthly completed orders.';
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { loading } = state.retailerAnalyticsCompletedOrders;
      if (loading) {
        return false;
      }
    },
  }
);

const completedOrdersSlice = createSlice({
  name: 'retailerAnalyticsCompletedOrders',
  initialState,
  reducers: {
    resetCompletedOrdersAnalytics(state) {
      state.data = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompletedOrdersAnalytics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompletedOrdersAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchCompletedOrdersAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetCompletedOrdersAnalytics } = completedOrdersSlice.actions;
export default completedOrdersSlice.reducer;
