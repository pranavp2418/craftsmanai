import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminDownloadInvoiceState {
  downloadingId: string | null;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminDownloadInvoiceState = {
  downloadingId: null,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const downloadInvoice = createAsyncThunk<
  void,
  { paymentId: string; invoiceId: string },
  { rejectValue: string }
>(
  'adminDownloadInvoice/download',
  async ({ paymentId, invoiceId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/admin/subscription-plans/payment-history/${paymentId}/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to download invoice.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminDownloadInvoiceSlice = createSlice({
  name: 'adminDownloadInvoice',
  initialState,
  reducers: {
    clearDownloadError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(downloadInvoice.pending, (state, action) => {
        state.downloadingId = action.meta.arg.paymentId;
        state.error = null;
      })
      .addCase(downloadInvoice.fulfilled, (state) => {
        state.downloadingId = null;
      })
      .addCase(downloadInvoice.rejected, (state, action) => {
        state.downloadingId = null;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { clearDownloadError } = adminDownloadInvoiceSlice.actions;
export default adminDownloadInvoiceSlice.reducer;
