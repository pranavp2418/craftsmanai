import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminExportPaymentHistoryState {
  exporting: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminExportPaymentHistoryState = {
  exporting: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const exportPaymentHistory = createAsyncThunk<
  void,
  { search?: string; status?: string },
  { rejectValue: string }
>(
  'adminExportPaymentHistory/export',
  async ({ search, status }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/admin/subscription-plans/payment-history/export', {
        responseType: 'blob',
        params: { search, status: (!status || status === 'All') ? '' : status.toLowerCase() }
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payment_history_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to export billing history.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminExportPaymentHistorySlice = createSlice({
  name: 'adminExportPaymentHistory',
  initialState,
  reducers: {
    clearExportError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(exportPaymentHistory.pending, (state) => {
        state.exporting = true;
        state.error = null;
      })
      .addCase(exportPaymentHistory.fulfilled, (state) => {
        state.exporting = false;
      })
      .addCase(exportPaymentHistory.rejected, (state, action) => {
        state.exporting = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { clearExportError } = adminExportPaymentHistorySlice.actions;
export default adminExportPaymentHistorySlice.reducer;
