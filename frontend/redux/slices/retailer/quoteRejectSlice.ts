import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface RejectQuotePayload {
  quoteId: number | string;
}

export interface RejectQuoteResponse {
  success: boolean;
  message?: string;
  [key: string]: any;
}

interface RejectQuoteState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

const initialState: RejectQuoteState = {
  loading: false,
  success: false,
  error: null,
};

export const rejectQuote = createAsyncThunk<
  RejectQuoteResponse,
  RejectQuotePayload,
  { rejectValue: string }
>(
  'retailer/quote/reject',
  async ({ quoteId }, { rejectWithValue }) => {
    try {
      console.info('[RejectQuote] API request', { quoteId });
      const response = await axiosInstance.put(
        `/api/v2/quotes/${quoteId}/reject`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      console.info('[RejectQuote] API response', response.data);
      return response.data as RejectQuoteResponse;
    } catch (error: any) {
      console.error('[RejectQuote] API error', error);
      const message = formatApiError(error) || 'Failed to reject quote.';
      return rejectWithValue(message);
    }
  }
);

const quoteRejectSlice = createSlice({
  name: 'retailerQuoteReject',
  initialState,
  reducers: {
    resetQuoteRejectState(state) {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(rejectQuote.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(rejectQuote.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(rejectQuote.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetQuoteRejectState } = quoteRejectSlice.actions;
export default quoteRejectSlice.reducer;
