import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface ResendMfgEmailsPayload {
  variantId: string | number;
}

export interface ResendMfgEmailsResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface ResendMfgEmailsState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: ResendMfgEmailsResponse | null;
}

const initialState: ResendMfgEmailsState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const resendManufacturerEmails = createAsyncThunk<
  ResendMfgEmailsResponse,
  ResendMfgEmailsPayload,
  { rejectValue: string }
>(
  'retailer/designVariantResendMfg/resend',
  async ({ variantId }, { rejectWithValue }) => {
    try {
      console.info('[ResendMfgEmails] API request', {
        url: `/api/v2/design-variant/variants/${variantId}/resend-manufacturer-emails`,
      });
      const response = await axiosInstance.post(
        `/api/v2/design-variant/variants/${variantId}/resend-manufacturer-emails`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      console.info('[ResendMfgEmails] API response', response.data);
      return response.data as ResendMfgEmailsResponse;
    } catch (error: any) {
      console.error('[ResendMfgEmails] API error', error);
      const message = formatApiError(error) || 'Failed to resend manufacturer emails.';
      return rejectWithValue(message);
    }
  }
);

const designVariantResendMfgSlice = createSlice({
  name: 'retailerDesignVariantResendMfg',
  initialState,
  reducers: {
    resetResendMfgState(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(resendManufacturerEmails.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(resendManufacturerEmails.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(resendManufacturerEmails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetResendMfgState } = designVariantResendMfgSlice.actions;
export default designVariantResendMfgSlice.reducer;
