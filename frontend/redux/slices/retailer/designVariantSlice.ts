import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface FetchVariantsParams {
  designId: string | number;
}

export interface FetchSingleVariantParams {
  variantId: string | number;
}

interface DesignVariantState {
  variants: any[];
  variantsLoading: boolean;
  variantsError: string | null;
  
  singleVariant: any | null;
  singleVariantLoading: boolean;
  singleVariantError: string | null;
}

const initialState: DesignVariantState = {
  variants: [],
  variantsLoading: false,
  variantsError: null,
  
  singleVariant: null,
  singleVariantLoading: false,
  singleVariantError: null,
};

// GET /api/v2/design-variant/{design_id}/variants
export const fetchVariantsByDesignId = createAsyncThunk<
  any[],
  FetchVariantsParams,
  { rejectValue: string }
>(
  'retailer/designVariant/fetchList',
  async ({ designId }, { rejectWithValue, signal }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/design-variant/${designId}/variants`, { signal });
      const raw = response.data;
      const items =
        Array.isArray(raw) ? raw :
        Array.isArray(raw?.items) ? raw.items :
        Array.isArray(raw?.data?.items) ? raw.data.items :
        Array.isArray(raw?.results) ? raw.results :
        [];
      return items;
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to fetch variants.';
      return rejectWithValue(message);
    }
  }
);

// GET /api/v2/design-variant/variants/{variant_id}
export const fetchVariantById = createAsyncThunk<
  any,
  FetchSingleVariantParams,
  { rejectValue: string }
>(
  'retailer/designVariant/fetchSingle',
  async ({ variantId }, { rejectWithValue, signal }) => {
    try {
      const response = await axiosInstance.get(`/api/v2/design-variant/variants/${variantId}`, { signal });
      return response.data;
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to fetch variant details.';
      return rejectWithValue(message);
    }
  }
);

const designVariantSlice = createSlice({
  name: 'retailerDesignVariant',
  initialState,
  reducers: {
    resetVariantsState(state) {
      state.variants = [];
      state.variantsLoading = false;
      state.variantsError = null;
    },
    resetSingleVariantState(state) {
      state.singleVariant = null;
      state.singleVariantLoading = false;
      state.singleVariantError = null;
    },
    removeVariantFromList(state, action: { payload: string | number }) {
      state.variants = state.variants.filter((v: any) => String(v.id) !== String(action.payload));
      if (state.singleVariant && String(state.singleVariant.id) === String(action.payload)) {
        state.singleVariant = null;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch List
      .addCase(fetchVariantsByDesignId.pending, (state) => {
        state.variantsLoading = true;
        state.variantsError = null;
        state.variants = []; // Clear stale variants list while loading
      })
      .addCase(fetchVariantsByDesignId.fulfilled, (state, action) => {
        console.log('[Slice Debug] fetchVariantsByDesignId fulfilled. Payload length:', action.payload?.length, 'Data:', action.payload);
        state.variantsLoading = false;
        state.variants = action.payload;
      })
      .addCase(fetchVariantsByDesignId.rejected, (state, action) => {
        const errorMsg = action.payload ?? action.error?.message ?? '';
        const isAbort = errorMsg.includes('canceled') || errorMsg.includes('Aborted') || action.error?.name === 'AbortError';
        if (isAbort) {
          console.log('[Slice Debug] fetchVariantsByDesignId request was canceled/aborted safely.');
        } else {
          console.error('[Slice Debug] fetchVariantsByDesignId rejected. Error:', errorMsg);
          state.variants = []; // Clear stale variants list if the request failed
        }
        state.variantsLoading = false;
        state.variantsError = action.payload ?? 'Unknown error';
      })
      // Fetch Single
      .addCase(fetchVariantById.pending, (state) => {
        state.singleVariantLoading = true;
        state.singleVariantError = null;
        state.singleVariant = null; // Clear stale single variant details while loading
      })
      .addCase(fetchVariantById.fulfilled, (state, action) => {
        console.log('[Slice Debug] fetchVariantById fulfilled. Payload:', action.payload);
        state.singleVariantLoading = false;
        state.singleVariant = action.payload;
      })
      .addCase(fetchVariantById.rejected, (state, action) => {
        const errorMsg = action.payload ?? action.error?.message ?? '';
        const isAbort = errorMsg.includes('canceled') || errorMsg.includes('Aborted') || action.error?.name === 'AbortError';
        if (isAbort) {
          console.log('[Slice Debug] fetchVariantById request was canceled/aborted safely.');
        } else {
          console.error('[Slice Debug] fetchVariantById rejected. Error:', errorMsg);
          state.singleVariant = null; // Clear stale single variant details on failure
        }
        state.singleVariantLoading = false;
        state.singleVariantError = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetVariantsState, resetSingleVariantState, removeVariantFromList } = designVariantSlice.actions;
export default designVariantSlice.reducer;
