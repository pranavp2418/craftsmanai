import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface CancelPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  monthly_price: number;
  yearly_price: number;
  duration_days: number;
  is_active: boolean;
  is_most_popular: boolean;
  feature_points: string[];
  monthly_renders: number;
  can_use_logo: boolean;
  can_use_brand_name: boolean;
  can_use_custom_color: boolean;
  has_unlimited_renders: boolean;
  created_at: string;
  updated_at: string | null;
  current_plan: boolean;
  current_pan: boolean;
}

interface CancelPlansState {
  items: CancelPlan[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: CancelPlansState = {
  items: [],
  status: 'idle',
  error: null,
};

export const fetchCancelPlans = createAsyncThunk<CancelPlan[], void, { rejectValue: string }>(
  'retailer/billing/fetchCancelPlans',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/retailer/subscriptions/cancel/plans');
      return response.data as CancelPlan[];
    } catch (error: any) {
      return rejectWithValue(formatApiError(error) || 'Failed to load cancel/downgrade plans.');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { status } = state.retailerCancelPlans;
      if (status === 'loading') {
        return false;
      }
    },
  }
);

const cancelPlansSlice = createSlice({
  name: 'retailerCancelPlans',
  initialState,
  reducers: {
    resetCancelPlansState: (state) => {
      state.status = 'idle';
      state.error = null;
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCancelPlans.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCancelPlans.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchCancelPlans.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load cancel/downgrade plans.';
      });
  },
});

export const { resetCancelPlansState } = cancelPlansSlice.actions;
export default cancelPlansSlice.reducer;
