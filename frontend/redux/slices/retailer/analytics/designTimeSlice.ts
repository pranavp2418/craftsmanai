import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface MonthDesignVolume {
  month: string;
  year: number;
  count: number | null | undefined;
}

export interface DesignTimeAnalyticsResponse {
  total_designs: number | null | undefined;
  months: MonthDesignVolume[];
}

interface DesignTimeAnalyticsState {
  data: DesignTimeAnalyticsResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: DesignTimeAnalyticsState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchDesignTimeAnalytics = createAsyncThunk<
  DesignTimeAnalyticsResponse,
  void,
  { rejectValue: string }
>(
  'retailer/analytics/designTime/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/analytics/design-time');
      return response.data as DesignTimeAnalyticsResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to fetch monthly design volume over time.';
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { loading } = state.retailerAnalyticsDesignTime;
      if (loading) {
        return false;
      }
    },
  }
);

const designTimeSlice = createSlice({
  name: 'retailerAnalyticsDesignTime',
  initialState,
  reducers: {
    resetDesignTimeAnalytics(state) {
      state.data = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDesignTimeAnalytics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDesignTimeAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDesignTimeAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetDesignTimeAnalytics } = designTimeSlice.actions;
export default designTimeSlice.reducer;
