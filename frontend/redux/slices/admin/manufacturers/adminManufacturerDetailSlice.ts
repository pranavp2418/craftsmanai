import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import { Manufacturer } from '@/app/admin/manufacturers/components/ManufacturerTable';

interface AdminManufacturerDetailState {
  detail: Manufacturer | null;
  loading: boolean;
  error: string | null;
}

const initialState: AdminManufacturerDetailState = {
  detail: null,
  loading: false,
  error: null,
};

export const fetchAdminManufacturerDetail = createAsyncThunk(
  'adminManufacturerDetail/fetch',
  async (manufacturerId: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/manufacturers/${manufacturerId}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = response.data;
      const rawStatus = d.status ?? 'INACTIVE';
      const stats = d.stats ?? {};

      const detail: Manufacturer = {
        id: d.manufacturer_id ?? d.id ?? '',
        name: d.name ?? '',
        manufacturerId: d.manufacturer_id ?? d.id ?? '',
        email: d.email ?? '',
        contactNumber: d.contact_number ?? '',
        location: d.location ?? '',
        status: rawStatus === 'ACTIVE' ? 'active' : 'disabled',
        jobsReceived: stats.jobs_received ?? d.jobs_received ?? 0,
        quotesSubmitted: stats.quotes_submitted ?? d.quotes_submitted ?? 0,
        joinedDate: d.joined_date ?? '',
        jewelleryType: d.jewellery_type ?? '',
        approvedJobs: stats.approved_jobs ?? 0,
        associatedRetailers: stats.associated_retailers ?? 0,
      };

      return detail;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to fetch manufacturer details'
      );
    }
  }
);

const adminManufacturerDetailSlice = createSlice({
  name: 'adminManufacturerDetail',
  initialState,
  reducers: {
    clearManufacturerDetail(state) {
      state.detail = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminManufacturerDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminManufacturerDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.detail = action.payload;
      })
      .addCase(fetchAdminManufacturerDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearManufacturerDetail } = adminManufacturerDetailSlice.actions;
export default adminManufacturerDetailSlice.reducer;
