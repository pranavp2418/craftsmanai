import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminDownloadPaymentRecordCSVState {
  exportingId: string | null;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminDownloadPaymentRecordCSVState = {
  exportingId: null,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const downloadPaymentRecordCSV = createAsyncThunk<
  void,
  { paymentId: string; invoiceId: string },
  { rejectValue: string }
>(
  'adminDownloadPaymentRecordCSV/download',
  async ({ paymentId, invoiceId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/admin/subscription-plans/payment-history/${paymentId}/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payment_${invoiceId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to export record.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminDownloadPaymentRecordCSVSlice = createSlice({
  name: 'adminDownloadPaymentRecordCSV',
  initialState,
  reducers: {
    clearExportError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(downloadPaymentRecordCSV.pending, (state, action) => {
        state.exportingId = action.meta.arg.paymentId;
        state.error = null;
      })
      .addCase(downloadPaymentRecordCSV.fulfilled, (state) => {
        state.exportingId = null;
      })
      .addCase(downloadPaymentRecordCSV.rejected, (state, action) => {
        state.exportingId = null;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { clearExportError } = adminDownloadPaymentRecordCSVSlice.actions;
export default adminDownloadPaymentRecordCSVSlice.reducer;
