import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface StatusDistributionItem {
  status: string;
  count: number;
}

interface AdminStatusDistributionState {
  data: StatusDistributionItem[];
  loading: boolean;
  error: string | null;
}

const initialState: AdminStatusDistributionState = {
  data: [],
  loading: false,
  error: null,
};

export const fetchStatusDistribution = createAsyncThunk(
  'adminStatusDistribution/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/requests/request-status-distribution`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = response.data?.data ?? response.data ?? {};
      const labelMap: Record<string, string> = {
        pending: 'Pending',
        in_progress: 'In Progress',
        quote_received: 'Quote Received',
        approved: 'Approved',
        completed: 'Completed',
      };
      return Object.entries(raw).map(([key, value]) => ({
        status: labelMap[key] ?? key,
        count: (value as number) ?? 0,
      })) as StatusDistributionItem[];
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to fetch status distribution'
      );
    }
  }
);

const adminStatusDistributionSlice = createSlice({
  name: 'adminStatusDistribution',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchStatusDistribution.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStatusDistribution.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchStatusDistribution.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default adminStatusDistributionSlice.reducer;
