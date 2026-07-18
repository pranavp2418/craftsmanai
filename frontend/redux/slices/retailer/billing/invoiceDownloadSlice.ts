import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { toast } from 'react-toastify';
import axiosInstance from '@/src/utils/hooks/axios';

export interface InvoiceDownloadPayload {
  paymentId: string;
}

interface InvoiceDownloadState {
  downloadingPaymentIds: string[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: InvoiceDownloadState = {
  downloadingPaymentIds: [],
  status: 'idle',
  error: null,
};

const getFilenameFromHeaders = (contentDisposition?: string | null) => {
  if (!contentDisposition) return null;
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^;\"]+)"?/i.exec(contentDisposition);
  const raw = match?.[1] || match?.[2];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export const downloadInvoicePdf = createAsyncThunk<
  string,
  InvoiceDownloadPayload,
  { rejectValue: string }
>(
  'retailer/billing/downloadInvoicePdf',
  async ({ paymentId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `/api/v2/invoices/payment/${paymentId}/download`,
        {
          responseType: 'blob',
          headers: {
            Accept: 'application/pdf, */*',
          },
        }
      );

      const contentDisposition = response.headers?.['content-disposition'] as string | undefined;
      const filename = getFilenameFromHeaders(contentDisposition) || `invoice_${paymentId}.pdf`;

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      return paymentId;
    } catch (error: any) {
      // If we got a blob error, we can't read the error JSON directly. Let's try reading it.
      let message = 'Failed to download invoice.';
      if (error?.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          message = parsed?.message || parsed?.detail || message;
        } catch {
          // ignore
        }
      } else {
        message = error?.response?.data?.message || error?.message || message;
      }
      
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

const invoiceDownloadSlice = createSlice({
  name: 'retailerInvoiceDownload',
  initialState,
  reducers: {
    clearInvoiceDownloadState(state) {
      state.status = 'idle';
      state.error = null;
      state.downloadingPaymentIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(downloadInvoicePdf.pending, (state, action) => {
        state.status = 'loading';
        state.error = null;
        const pid = action.meta.arg.paymentId;
        if (!state.downloadingPaymentIds.includes(pid)) {
          state.downloadingPaymentIds.push(pid);
        }
      })
      .addCase(downloadInvoicePdf.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.downloadingPaymentIds = state.downloadingPaymentIds.filter(
          (id) => id !== action.payload
        );
      })
      .addCase(downloadInvoicePdf.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Failed to download invoice.';
        const pid = action.meta.arg.paymentId;
        state.downloadingPaymentIds = state.downloadingPaymentIds.filter(
          (id) => id !== pid
        );
      });
  },
});

export const { clearInvoiceDownloadState } = invoiceDownloadSlice.actions;
export default invoiceDownloadSlice.reducer;
