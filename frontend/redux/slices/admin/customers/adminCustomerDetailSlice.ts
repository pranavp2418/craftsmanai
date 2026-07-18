import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import { Customer } from '@/app/admin/customers/components/CustomerTable';

interface AdminCustomerDetailState {
  customer: Customer | null;
  loading: boolean;
  error: string | null;
}

const initialState: AdminCustomerDetailState = {
  customer: null,
  loading: false,
  error: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCustomer(c: any, orders?: any): Customer {
  return {
    id: c.id ?? '',
    name: c.name ?? '',
    customerId: c.id ?? '',
    email: c.email ?? '',
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
    totalOrders: orders?.total_orders ?? orders?.totalOrders ?? c.total_orders ?? c.totalOrders ?? 0,
    completedOrders: orders?.completed_orders ?? orders?.completedOrders ?? c.completed_orders ?? c.completedOrders ?? 0,
    activeOrders: orders?.active_orders ?? orders?.activeOrders ?? c.active_orders ?? c.activeOrders ?? 0,
    lastActivity: c.Last_active ?? c.last_active ?? c.lastActivity ?? '',
  };
}

export const fetchAdminCustomerDetail = createAsyncThunk(
  'adminCustomerDetail/fetch',
  async (customerId: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/customers/${customerId}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = response.data;
      const raw = data?.customer ?? data?.data ?? data;
      const orders = data?.orders ?? null;
      return normalizeCustomer(raw, orders);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to fetch customer details'
      );
    }
  }
);

const adminCustomerDetailSlice = createSlice({
  name: 'adminCustomerDetail',
  initialState,
  reducers: {
    clearCustomerDetail(state) {
      state.customer = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminCustomerDetail.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.customer = null;
      })
      .addCase(fetchAdminCustomerDetail.fulfilled, (state, action) => {
        state.loading = false;
        state.customer = action.payload;
      })
      .addCase(fetchAdminCustomerDetail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCustomerDetail } = adminCustomerDetailSlice.actions;
export default adminCustomerDetailSlice.reducer;
