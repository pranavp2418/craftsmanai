import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface InvoiceItem {
  id: string;
  invoice_number: string;
  payment_id: string;
  amount: string | number;
  currency: string;
  pdf_url: string;
  created_at: string;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface InvoicesResponse {
  success: boolean;
  data: InvoiceItem[];
  pagination: Pagination;
}

interface InvoicesState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  invoices: InvoiceItem[];
  pagination: Pagination | null;
}

const initialState: InvoicesState = {
  status: 'idle',
  error: null,
  invoices: [],
  pagination: null,
};

export const fetchInvoices = createAsyncThunk<
  InvoicesResponse,
  { page?: number; limit?: number } | undefined,
  { rejectValue: string }
>(
  'retailer/billing/fetchInvoices',
  async (params, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/invoices/', {
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 10,
        },
      });
      if (response.data && response.data.success) {
        return response.data as InvoicesResponse;
      }
      return rejectWithValue('Failed to fetch invoices.');
    } catch (error: any) {
      return rejectWithValue(formatApiError(error) || 'Failed to load invoices.');
    }
  },
  {
    condition: (params, { getState }) => {
      const state = getState() as any;
      const { status } = state.retailerInvoices;
      if (status === 'loading') {
        return false;
      }
    },
  }
);

const invoicesSlice = createSlice({
  name: 'retailerInvoices',
  initialState,
  reducers: {
    clearInvoices: (state) => {
      state.invoices = [];
      state.pagination = null;
      state.status = 'idle';
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInvoices.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchInvoices.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const newInvoices = action.payload.data || [];
        const isFirstPage = action.meta.arg?.page === 1 || !action.meta.arg?.page;
        if (isFirstPage) {
          state.invoices = newInvoices;
        } else {
          const existingIds = new Set(state.invoices.map((inv) => inv.id));
          const uniqueNewInvoices = newInvoices.filter((inv) => !existingIds.has(inv.id));
          state.invoices = [...state.invoices, ...uniqueNewInvoices];
        }
        state.pagination = action.payload.pagination || null;
      })
      .addCase(fetchInvoices.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load invoices.';
      });
  },
});

export const { clearInvoices } = invoicesSlice.actions;
export default invoicesSlice.reducer;
