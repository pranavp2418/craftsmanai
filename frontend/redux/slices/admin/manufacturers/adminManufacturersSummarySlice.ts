import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

interface ManufacturerSummary {
  totalManufacturers: number;
  activeManufacturers: number;
  disabledManufacturers: number;
  totalJobs: number;
}

interface AdminManufacturersSummaryState {
  summary: ManufacturerSummary;
  loading: boolean;
  error: string | null;
}

const initialState: AdminManufacturersSummaryState = {
  summary: {
    totalManufacturers: 0,
    activeManufacturers: 0,
    disabledManufacturers: 0,
    totalJobs: 0,
  },
  loading: false,
  error: null,
};

export const fetchAdminManufacturersSummary = createAsyncThunk(
  'adminManufacturersSummary/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/manufacturers/summary`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = response.data;
      return {
        totalManufacturers: d.total_manufacturers ?? d.totalManufacturers ?? 0,
        activeManufacturers: d.active_manufacturers ?? d.activeManufacturers ?? 0,
        disabledManufacturers: d.inactive_manufacturers ?? d.disabled_manufacturers ?? d.disabledManufacturers ?? 0,
        totalJobs: d.total_jobs ?? d.totalJobs ?? 0,
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to fetch manufacturers summary'
      );
    }
  }
);

const adminManufacturersSummarySlice = createSlice({
  name: 'adminManufacturersSummary',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminManufacturersSummary.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminManufacturersSummary.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload;
      })
      .addCase(fetchAdminManufacturersSummary.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default adminManufacturersSummarySlice.reducer;
