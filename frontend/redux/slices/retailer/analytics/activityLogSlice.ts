import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export type ActivityLogActorType = 'manufacturer' | 'customer';

export interface ActivityLogItem {
  request_id?: string | null;
  type?: string | null;
  manufacturer?: string | null;
  customer?: string | null;
  date?: string | null;
  status?: string | null;
  actor_type?: ActivityLogActorType | string | null;
}

export interface ActivityLogResponse {
  items?: ActivityLogItem[] | null;
  total_items?: number | null;
  filter?: string | null;
}

interface ActivityLogState {
  items: ActivityLogItem[];
  totalItems: number;
  filter: string | null;
  loading: boolean;
  error: string | null;
  activeActorType: ActivityLogActorType;
}

const initialState: ActivityLogState = {
  items: [],
  totalItems: 0,
  filter: null,
  loading: false,
  error: null,
  activeActorType: 'manufacturer',
};

export const fetchActivityLog = createAsyncThunk<
  ActivityLogResponse,
  { actorType: ActivityLogActorType },
  { rejectValue: string }
>(
  'retailer/analytics/activityLog/fetch',
  async ({ actorType }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/analytics/activity-log', {
        params: { actor_type: actorType },
      });
      return response.data as ActivityLogResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to fetch activity log.';
      return rejectWithValue(message);
    }
  },
  {
    condition: ({ actorType }, { getState }) => {
      const state = getState() as any;
      const { loading } = state.retailerAnalyticsActivityLog;
      if (loading) {
        return false;
      }
    },
  }
);

const activityLogSlice = createSlice({
  name: 'retailerAnalyticsActivityLog',
  initialState,
  reducers: {
    resetActivityLog(state) {
      state.items = [];
      state.totalItems = 0;
      state.filter = null;
      state.loading = false;
      state.error = null;
      state.activeActorType = 'manufacturer';
    },
    setActivityLogActorType(state, action) {
      state.activeActorType = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActivityLog.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.activeActorType = action.meta.arg.actorType;
      })
      .addCase(fetchActivityLog.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items ?? [];
        state.totalItems = action.payload.total_items ?? 0;
        state.filter = action.payload.filter ?? null;
      })
      .addCase(fetchActivityLog.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetActivityLog, setActivityLogActorType } = activityLogSlice.actions;
export default activityLogSlice.reducer;