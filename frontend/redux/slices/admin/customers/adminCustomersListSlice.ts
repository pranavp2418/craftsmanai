import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import { Customer } from '@/app/admin/customers/components/CustomerTable';

interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface AdminCustomersListState {
  customers: Customer[];
  pagination: Pagination;
  loading: boolean;
  error: string | null;
}

const initialState: AdminCustomersListState = {
  customers: [],
  pagination: {
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
  loading: false,
  error: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCustomer(c: any): Customer {
  return {
    id: c.id ?? '',
    name: c.name ?? '',
    customerId: c.id ?? '',
    email: c.email ?? c.emails?.[0]?.email ?? '',
    phone: c.phone ?? '',
    location: c.location ?? '',
    status: c.status ?? 'INACTIVE',
    createdAt: c.created_at ?? c.createdAt ?? '',
    associatedRetailers: c.retailer?.name ?? c.associatedRetailers ?? '',
    retailer: {
      id: c.retailer?.id ?? '',
      name: c.retailer?.name ?? '',
      email: c.retailer?.email ?? '',
    },
    totalOrders: c.total_orders ?? c.totalOrders ?? 0,
    completedOrders: c.completed_orders ?? c.completedOrders ?? 0,
    activeOrders: c.active_orders ?? c.activeOrders ?? 0,
    lastActivity: c.Last_active ?? c.last_active ?? c.lastActivity ?? '',
  };
}

export const fetchAdminCustomersList = createAsyncThunk(
  'adminCustomersList/fetch',
  async (
    params: { page?: number; limit?: number; status?: string; subfilter?: string; search?: string } = {},
    { rejectWithValue }
  ) => {
    try {
      const { page = 1, limit = 20, status, subfilter, search } = params;
      // Build query params — only include optional params if they have a value
      const queryParams: Record<string, string | number> = { page, limit };
      if (status) queryParams.status = status;
      if (subfilter) queryParams.subfilter = subfilter;
      if (search) queryParams.search = search;

      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/customers/`,
        { params: queryParams }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = response.data;
      const raw = data?.customers ?? data?.data ?? data?.results ?? [];
      const pg = data?.pagination ?? {};
      return {
        customers: raw.map(normalizeCustomer),
        pagination: {
          page: pg.page ?? page,
          limit: pg.limit ?? limit,
          totalItems: pg.total_items ?? pg.totalItems ?? raw.length,
          totalPages: pg.total_pages ?? pg.totalPages ?? 1,
          hasNext: pg.has_next ?? pg.hasNext ?? false,
          hasPrev: pg.has_prev ?? pg.hasPrev ?? false,
        } as Pagination,
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to fetch customers'
      );
    }
  }
);

const adminCustomersListSlice = createSlice({
  name: 'adminCustomersList',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminCustomersList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminCustomersList.fulfilled, (state, action) => {
        state.loading = false;
        state.customers = action.payload.customers;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAdminCustomersList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default adminCustomersListSlice.reducer;
