import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import { fetchDesigns } from '@/redux/slices/retailer/designsSlice';

export interface ShareVariantPayload {
  variantId: string | number;
  customer_id?: number;
  comment?: string;
  metal?: string | any;
  angles?: string[];
}

export interface ShareVariantResponse {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

interface ShareVariantState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: ShareVariantResponse | null;
}

const initialState: ShareVariantState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const shareVariant = createAsyncThunk<
  ShareVariantResponse,
  ShareVariantPayload,
  { rejectValue: string }
>(
  'retailer/designVariantShare/share',
  async ({ variantId, customer_id, comment, metal, angles }, { dispatch, rejectWithValue }) => {
    try {
      console.info('[ShareVariant] API request', {
        url: `/api/v2/design/variants/${variantId}/share`,
        customer_id,
        comment,
        metal,
        angles
      });
      
      const body = customer_id !== undefined ? { customer_id, comment, metal, angles } : {};
      
      const response = await axiosInstance.post(
        `/api/v2/design/variants/${variantId}/share`,
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      
      console.info('[ShareVariant] API response', response.data);
      return response.data as ShareVariantResponse;
    } catch (error: any) {
      console.error('[ShareVariant] API error', error);
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to share design variant.';
      return rejectWithValue(message);
    }
  }
);

const designVariantShareSlice = createSlice({
  name: 'retailerDesignVariantShare',
  initialState,
  reducers: {
    resetShareState(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(shareVariant.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(shareVariant.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(shareVariant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetShareState } = designVariantShareSlice.actions;
export default designVariantShareSlice.reducer;
