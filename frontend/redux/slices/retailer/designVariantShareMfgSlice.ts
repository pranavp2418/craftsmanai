import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';
import { fetchDesigns } from '@/redux/slices/retailer/designsSlice';

export interface ShareVariantMfgPayload {
  variantId: string | number;
  manufacturer_ids: number[];
  emails?: Record<string, string[]>;
  angles?: string[];
}

export interface ShareVariantMfgResponse {
  success?: boolean;
  message?: string;
  public_token?: string;
  [key: string]: unknown;
}

interface ShareVariantMfgState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: ShareVariantMfgResponse | null;
}

const initialState: ShareVariantMfgState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const shareVariantWithManufacturer = createAsyncThunk<
  ShareVariantMfgResponse,
  ShareVariantMfgPayload,
  { rejectValue: string }
>(
  'retailer/designVariantShareMfg/share',
  async ({ variantId, manufacturer_ids, ...rest }, { dispatch, rejectWithValue }) => {
    try {
      console.info('[ShareVariantMfg] API request', {
        url: `/api/v2/design-variant/variants/${variantId}/share-with-manufacturer`,
        manufacturer_ids,
        ...rest,
      });
      const response = await axiosInstance.post(
        `/api/v2/design-variant/variants/${variantId}/share-with-manufacturer`,
        {
          manufacturer_ids,
          ...rest,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      
      console.info('[ShareVariantMfg] API response', response.data);
      return response.data as ShareVariantMfgResponse;
    } catch (error: any) {
      console.error('[ShareVariantMfg] API error', error);
      const message = formatApiError(error) || 'Failed to share design variant with manufacturer.';
      return rejectWithValue(message);
    }
  }
);

const designVariantShareMfgSlice = createSlice({
  name: 'retailerDesignVariantShareMfg',
  initialState,
  reducers: {
    resetShareMfgState(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(shareVariantWithManufacturer.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(shareVariantWithManufacturer.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(shareVariantWithManufacturer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetShareMfgState } = designVariantShareMfgSlice.actions;
export default designVariantShareMfgSlice.reducer;
