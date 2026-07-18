import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentHistoryItem {
  id: string;
  invoice_id: string;
  user_id: string;
  plan_id: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  retailer_name: string;
  plan_name: string;
}

interface AdminPaymentHistoryState {
  history: PaymentHistoryItem[];
  total: number;
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminPaymentHistoryState = {
  history: [],
  total: 0,
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchPaymentHistory = createAsyncThunk<
  { success: boolean; data: PaymentHistoryItem[]; total: number },
  { search?: string; status?: string } | void,
  { rejectValue: string }
>(
  'adminPaymentHistory/fetch',
  async (arg, { rejectWithValue }) => {
    try {
      const params: Record<string, string> = {};
      const search = (arg as { search?: string; status?: string })?.search;
      const status = (arg as { search?: string; status?: string })?.status;
      if (search) params.search = search;
      if (status && status !== 'All') params.status = status.toUpperCase();
      const response = await axiosInstance.get('/api/v2/admin/subscription-plans/payment-history/', { params });
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch payment history.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminPaymentHistorySlice = createSlice({
  name: 'adminPaymentHistory',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPaymentHistory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPaymentHistory.fulfilled, (state, action) => {
        state.loading = false;
        state.history = action.payload.data;
        state.total = action.payload.total;
      })
      .addCase(fetchPaymentHistory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminPaymentHistorySlice.reducer;
