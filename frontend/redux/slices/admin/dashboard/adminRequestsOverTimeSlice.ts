import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface RequestsOverTimeItem {
  date: string;
  requests: number;
}

interface AdminRequestsOverTimeState {
  data: RequestsOverTimeItem[];
  loading: boolean;
  error: string | null;
}

const initialState: AdminRequestsOverTimeState = {
  data: [],
  loading: false,
  error: null,
};

export const fetchRequestsOverTime = createAsyncThunk(
  'adminRequestsOverTime/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/requests/requests-over-time`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = response.data?.data ?? response.data ?? [];
      return raw.map((item) => ({
        date: item.date ?? item.label ?? item.period ?? '',
        requests: item.requests ?? item.count ?? item.value ?? 0,
      })) as RequestsOverTimeItem[];
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to fetch requests over time'
      );
    }
  }
);

const adminRequestsOverTimeSlice = createSlice({
  name: 'adminRequestsOverTime',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchRequestsOverTime.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRequestsOverTime.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchRequestsOverTime.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default adminRequestsOverTimeSlice.reducer;
