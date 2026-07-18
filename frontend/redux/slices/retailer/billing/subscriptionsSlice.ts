import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  monthly_price: string;
  yearly_price: string;
  duration_days: number;
  is_active: boolean;
  is_most_popular: boolean;
  feature_points: string[];
  monthly_renders: number;
  customer_shares: number;
  manufacturer_quotes: number;
  created_at: string;
  updated_at: string;
}

interface SubscriptionsState {
  items: SubscriptionPlan[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: SubscriptionsState = {
  items: [],
  status: 'idle',
  error: null,
};

export const fetchSubscriptions = createAsyncThunk<SubscriptionPlan[], void, { rejectValue: string }>(
  'retailer/billing/fetchSubscriptions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/retailer/subscriptions/');
      return response.data as SubscriptionPlan[];
    } catch (error: any) {
      return rejectWithValue(formatApiError(error) || 'Failed to load subscription plans.');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { status } = state.retailerSubscriptions;
      if (status === 'loading') {
        return false;
      }
    },
  }
);

const subscriptionsSlice = createSlice({
  name: 'retailerSubscriptions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSubscriptions.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSubscriptions.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchSubscriptions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load subscription plans.';
      });
  },
});

export default subscriptionsSlice.reducer;
