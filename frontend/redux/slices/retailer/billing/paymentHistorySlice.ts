import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface PlanDetails {
  id: string;
  name: string;
  description: string;
  price: number;
  monthlyPrice: number;
  yearlyPrice: number;
}

export interface PaymentItem {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
  updatedAt: string | null;
  plan: PlanDetails | null;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaymentHistoryData {
  payments: PaymentItem[];
  pagination: Pagination;
}

interface PaymentHistoryState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  payments: PaymentItem[];
  pagination: Pagination | null;
}

const initialState: PaymentHistoryState = {
  status: 'idle',
  error: null,
  payments: [],
  pagination: null,
};

export const fetchPaymentHistory = createAsyncThunk<
  PaymentHistoryData,
  { page?: number; limit?: number } | undefined,
  { rejectValue: string }
>(
  'retailer/billing/fetchPaymentHistory',
  async (params, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/retailer/subscriptions/payment-history', {
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 10,
        },
      });
      if (response.data && response.data.success && response.data.data) {
        return response.data.data as PaymentHistoryData;
      }
      if (response.data && Array.isArray(response.data.payments)) {
        return response.data as unknown as PaymentHistoryData;
      }
      return rejectWithValue('Failed to fetch payment history.');
    } catch (error: any) {
      return rejectWithValue(formatApiError(error) || 'Failed to load payment history.');
    }
  },
  {
    condition: (params, { getState }) => {
      const state = getState() as any;
      const { status } = state.retailerPaymentHistory;
      if (status === 'loading') {
        return false;
      }
    },
  }
);

const paymentHistorySlice = createSlice({
  name: 'retailerPaymentHistory',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPaymentHistory.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPaymentHistory.fulfilled, (state, action) => {
        state.status = 'succeeded';
        const newPayments = action.payload.payments || [];
        const isFirstPage = action.meta.arg?.page === 1 || !action.meta.arg?.page;
        if (isFirstPage) {
          state.payments = newPayments;
        } else {
          const existingIds = new Set(state.payments.map((p) => p.id));
          const uniqueNewPayments = newPayments.filter((p) => !existingIds.has(p.id));
          state.payments = [...state.payments, ...uniqueNewPayments];
        }
        state.pagination = action.payload.pagination || null;
      })
      .addCase(fetchPaymentHistory.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load payment history.';
      });
  },
});

export default paymentHistorySlice.reducer;
