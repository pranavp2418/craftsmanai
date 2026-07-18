import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface ApproveQuotePayload {
  quoteId: number | string;
}

export interface ApproveQuoteResponse {
  success: boolean;
  message?: string;
  [key: string]: any;
}

interface ApproveQuoteState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

const initialState: ApproveQuoteState = {
  loading: false,
  success: false,
  error: null,
};

export const approveQuote = createAsyncThunk<
  ApproveQuoteResponse,
  ApproveQuotePayload,
  { rejectValue: string }
>(
  'retailer/quote/approve',
  async ({ quoteId }, { rejectWithValue }) => {
    try {
      console.info('[ApproveQuote] API request', { quoteId });
      const response = await axiosInstance.put(
        `/api/v2/quotes/${quoteId}/approve`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      console.info('[ApproveQuote] API response', response.data);
      return response.data as ApproveQuoteResponse;
    } catch (error: any) {
      console.error('[ApproveQuote] API error', error);
      const message = formatApiError(error) || 'Failed to approve quote.';
      return rejectWithValue(message);
    }
  }
);

const quoteApproveSlice = createSlice({
  name: 'retailerQuoteApprove',
  initialState,
  reducers: {
    resetQuoteApproveState(state) {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(approveQuote.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(approveQuote.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(approveQuote.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetQuoteApproveState } = quoteApproveSlice.actions;
export default quoteApproveSlice.reducer;
