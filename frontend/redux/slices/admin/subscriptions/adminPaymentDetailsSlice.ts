import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentDetails {
  id: string;
  invoice_id: string;
  user_id: string;
  plan_id: string;
  amount: string;
  currency: string;
  status: string;
  payment_method: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
  retailer_name: string;
  plan_name: string;
}

interface AdminPaymentDetailsState {
  data: PaymentDetails | null;
  loading: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminPaymentDetailsState = {
  data: null,
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchPaymentDetails = createAsyncThunk<
  { success: boolean; data: PaymentDetails },
  string,
  { rejectValue: string }
>(
  'adminPaymentDetails/fetch',
  async (paymentId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/admin/subscription-plans/payment-history/${paymentId}`);
      return response.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch payment details.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminPaymentDetailsSlice = createSlice({
  name: 'adminPaymentDetails',
  initialState,
  reducers: {
    clearDetails: (state) => {
      state.data = null;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPaymentDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPaymentDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload.data;
      })
      .addCase(fetchPaymentDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { clearDetails } = adminPaymentDetailsSlice.actions;
export default adminPaymentDetailsSlice.reducer;
