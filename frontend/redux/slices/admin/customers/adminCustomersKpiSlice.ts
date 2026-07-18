import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface AdminCustomersKpi {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  totalOrders: number;
}

interface AdminCustomersKpiState {
  kpi: AdminCustomersKpi;
  loading: boolean;
  error: string | null;
}

const initialState: AdminCustomersKpiState = {
  kpi: {
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    totalOrders: 0,
  },
  loading: false,
  error: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeKpi(data: any): AdminCustomersKpi {
  const d = data?.data ?? data?.kpi ?? data ?? {};
  return {
    totalCustomers:
      d.totalCustomers ??
      d.total_customers ??
      d.total_customer ??
      0,
    activeCustomers:
      d.activeCustomers ??
      d.active_customers ??
      d.active_customer ??
      0,
    inactiveCustomers:
      d.inactiveCustomers ??
      d.inactive_customers ??
      d.inactive_customer ??
      0,
    totalOrders:
      d.totalOrders ??
      d.total_orders ??
      d.total_order ??
      0,
  };
}

export const fetchAdminCustomersKpi = createAsyncThunk(
  'adminCustomersKpi/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/customers/customer/kpi`
      );
      return normalizeKpi(response.data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to fetch customer KPIs'
      );
    }
  }
);

const adminCustomersKpiSlice = createSlice({
  name: 'adminCustomersKpi',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminCustomersKpi.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminCustomersKpi.fulfilled, (state, action) => {
        state.loading = false;
        state.kpi = action.payload;
      })
      .addCase(fetchAdminCustomersKpi.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default adminCustomersKpiSlice.reducer;
