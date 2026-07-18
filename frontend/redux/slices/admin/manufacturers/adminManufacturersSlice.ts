import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import { Manufacturer } from '@/app/admin/manufacturers/components/ManufacturerTable';

interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface AdminManufacturersState {
  manufacturers: Manufacturer[];
  pagination: Pagination;
  loading: boolean;
  error: string | null;
}

const initialState: AdminManufacturersState = {
  manufacturers: [],
  pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 1, hasNext: false, hasPrev: false },
  loading: false,
  error: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeManufacturer(m: any): Manufacturer {
  const rawStatus = (m.status ?? 'DISABLED').toUpperCase();
  // Backend returns ACTIVE or DISABLED status
  return {
    id: m.manufacturer_id ?? m.id ?? '',
    name: m.name ?? '',
    manufacturerId: m.manufacturer_id ?? m.id ?? '',
    email: Array.isArray(m.email) ? m.email?.[0]?.email ?? '' : m.email ?? '',
    contactNumber: m.contact_number ?? m.contactNumber ?? '',
    location: m.location ?? '',
    status: rawStatus === 'ACTIVE' ? 'active' : 'disabled',
    jobsReceived: m.jobs_received ?? m.jobsReceived ?? 0,
    quotesSubmitted: m.quotes_submitted ?? m.quotesSubmitted ?? 0,
    joinedDate: m.joined_date ?? m.joinedDate ?? '',
  };
}

export const fetchAdminManufacturers = createAsyncThunk(
  'adminManufacturers/fetch',
  async (
    params: { page?: number; limit?: number; status?: string; subfilter?: string; search?: string } = {},
    { rejectWithValue }
  ) => {
    try {
      const { page = 1, limit = 20, status, subfilter, search } = params;
      // Build query params — only include optional params if they have a value
      const queryParams: Record<string, string | number> = { page, limit };
      if (status && status !== 'all') queryParams.status = status;
      if (subfilter) queryParams.subfilter = subfilter;
      if (search) queryParams.search = search;

      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/manufacturers/`,
        { params: queryParams }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = response.data;
      const raw = data?.manufacturers ?? data?.data ?? data?.results ?? [];
      const pg = data?.pagination ?? {};
      return {
        manufacturers: raw.map(normalizeManufacturer),
        pagination: {
          page: pg.page ?? page,
          limit: pg.limit ?? limit,
          totalItems: pg.total_items ?? pg.totalItems ?? raw.length,
          totalPages: pg.total_pages ?? pg.totalPages ?? 1,
          hasNext: pg.has_next ?? pg.hasNext ?? false,
          hasPrev: pg.has_prev ?? pg.hasPrev ?? false,
        },
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to fetch manufacturers'
      );
    }
  }
);

const adminManufacturersSlice = createSlice({
  name: 'adminManufacturers',
  initialState,
  reducers: {
    updateManufacturerStatus(
      state,
      action: { payload: { id: string; status: 'active' | 'disabled' } }
    ) {
      const m = state.manufacturers.find((x) => x.id === action.payload.id);
      if (m) m.status = action.payload.status;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminManufacturers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminManufacturers.fulfilled, (state, action) => {
        state.loading = false;
        state.manufacturers = action.payload.manufacturers;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAdminManufacturers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { updateManufacturerStatus } = adminManufacturersSlice.actions;
export default adminManufacturersSlice.reducer;
