import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';
import { SubscriptionPlan } from './subscriptionsSlice';

export interface MyPlan {
  id: string;
  user_id: number;
  plan_id: string;
  plan_name?: string;
  plan?: SubscriptionPlan | null;
  start_date: string;
  end_date: string;
  status: string;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface MyPlanState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  plan: MyPlan | null;
}

const initialState: MyPlanState = {
  status: 'idle',
  error: null,
  plan: null,
};

export const fetchMyPlan = createAsyncThunk<MyPlan, void, { rejectValue: string }>(
  'retailer/billing/fetchMyPlan',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/retailer/subscriptions/my-plan');
      // API returns an array, we take the first active plan if exists.
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0] as MyPlan;
      }
      return rejectWithValue('No plan found.');
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to load my plan.';
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { status } = state.retailerMyPlan;
      if (status === 'loading') {
        return false;
      }
    },
  }
);

const myPlanSlice = createSlice({
  name: 'retailerMyPlan',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyPlan.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchMyPlan.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.plan = action.payload;
      })
      .addCase(fetchMyPlan.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load my plan.';
      });
  },
});

export default myPlanSlice.reducer;
