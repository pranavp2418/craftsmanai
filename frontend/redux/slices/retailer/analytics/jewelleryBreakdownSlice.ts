import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface JewelleryBreakdownCategory {
  label?: string | null;
  count?: number | null;
  rate?: number | null;
}

export interface JewelleryBreakdownResponse {
  total_designs?: number | null;
  categories?: JewelleryBreakdownCategory[] | null;
}

interface JewelleryBreakdownState {
  data: JewelleryBreakdownResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: JewelleryBreakdownState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchJewelleryBreakdown = createAsyncThunk<
  JewelleryBreakdownResponse,
  void,
  { rejectValue: string }
>(
  'retailer/analytics/jewelleryBreakdown/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/analytics/jewellery-breakdown');
      return response.data as JewelleryBreakdownResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to fetch jewelery breakdown.';
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { loading } = state.retailerAnalyticsJewelleryBreakdown;
      if (loading) {
        return false;
      }
    },
  }
);

const jewelleryBreakdownSlice = createSlice({
  name: 'retailerAnalyticsJewelleryBreakdown',
  initialState,
  reducers: {
    resetJewelleryBreakdown(state) {
      state.data = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchJewelleryBreakdown.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchJewelleryBreakdown.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchJewelleryBreakdown.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetJewelleryBreakdown } = jewelleryBreakdownSlice.actions;
export default jewelleryBreakdownSlice.reducer;
