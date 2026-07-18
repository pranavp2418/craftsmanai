import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';
import axios from 'axios';

export interface ManufacturerEmail {
  label: string;
  email: string;
}

export interface ManufacturerDetail {
  id: number;
  created_by_user_id: number;
  name: string;
  speciality: string;
  emails: ManufacturerEmail[];
  phone_number: string;
  location: string;
  status: string;
  public_token: string;
  created_at: string;
  updated_at: string;
  stats?: {
    total_requests?: number;
    completed_requests?: number;
    avg_response_time?: string;
  };
}

export interface ManufacturerShare {
  id: number;
  design_variant_id: number;
  manufacturer_id: number;
  manufacturer: ManufacturerDetail;
  shared_date: string;
  quoted_price: number | null;
  estimated_delivery_days: number | null;
  estimated_delivery_date: string | null;
  manufacturer_notes: string | null;
  status: string;
  public_token: string;
  shared_metal: string;
}

export interface DesignVariantManufacturerSharesResponse {
  variant_id: number;
  variant_name: string;
  version_number: number;
  design_id: number;
  design_code: string;
  design_name: string;
  design_variant_status: string;
  design_status: string;
  total_shares: number;
  shares: ManufacturerShare[];
}

interface DesignVariantManufacturerSharesState {
  shares: ManufacturerShare[];
  variant_id: number | null;
  variant_name: string | null;
  version_number: number | null;
  design_id: number | null;
  design_code: string | null;
  design_name: string | null;
  design_variant_status: string | null;
  design_status: string | null;
  total_shares: number;
  loading: boolean;
  error: string | null;
  lastQueriedVariantId: number | null;
  lastFetchedTimestamp: number;
}

const initialState: DesignVariantManufacturerSharesState = {
  shares: [],
  variant_id: null,
  variant_name: null,
  version_number: null,
  design_id: null,
  design_code: null,
  design_name: null,
  design_variant_status: null,
  design_status: null,
  total_shares: 0,
  loading: false,
  error: null,
  lastQueriedVariantId: null,
  lastFetchedTimestamp: 0,
};

export const fetchDesignVariantManufacturerShares = createAsyncThunk<
  DesignVariantManufacturerSharesResponse,
  { variantId: string | number; forceRefresh?: boolean },
  { rejectValue: string }
>(
  'retailer/designVariantManufacturerShares/fetch',
  async ({ variantId }, { rejectWithValue, signal }) => {
    try {
      console.info('[FetchDesignVariantManufacturerShares] API request', {
        url: `/api/v2/design-variant/variants/${variantId}/manufacturer-shares`,
      });
      const response = await axiosInstance.get(
        `/api/v2/design-variant/variants/${variantId}/manufacturer-shares`,
        { signal }
      );
      console.info('[FetchDesignVariantManufacturerShares] API response', response.data);
      return response.data as DesignVariantManufacturerSharesResponse;
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return rejectWithValue('canceled');
      }
      const is404 = error?.response?.status === 404;
      if (!is404) {
        console.error('[FetchDesignVariantManufacturerShares] API error', error);
      }
      const message = formatApiError(error) || 'Failed to fetch design variant manufacturer shares.';
      return rejectWithValue(message);
    }
  },
  {
    condition: ({ variantId, forceRefresh }, { getState }) => {
      if (forceRefresh) return true;
      const state = getState() as any;
      const sharesState = state.retailerDesignVariantManufacturerShares;
      if (sharesState) {
        if (sharesState.loading) {
          console.info('[FetchDesignVariantManufacturerShares] Aborted fetch: already loading');
          return false;
        }
        const timeDiff = Date.now() - (sharesState.lastFetchedTimestamp || 0);
        if (timeDiff < 1000 && sharesState.lastQueriedVariantId === Number(variantId)) {
          console.info('[FetchDesignVariantManufacturerShares] Aborted fetch: double-mount protection for variantId', variantId);
          return false;
        }
      }
    }
  }
);

const designVariantManufacturerSharesSlice = createSlice({
  name: 'retailerDesignVariantManufacturerShares',
  initialState,
  reducers: {
    resetSharesState(state) {
      state.shares = [];
      state.variant_id = null;
      state.variant_name = null;
      state.version_number = null;
      state.design_id = null;
      state.design_code = null;
      state.design_name = null;
      state.design_variant_status = null;
      state.design_status = null;
      state.total_shares = 0;
      state.loading = false;
      state.error = null;
      state.lastQueriedVariantId = null;
      state.lastFetchedTimestamp = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDesignVariantManufacturerShares.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.shares = [];
        state.variant_id = null;
        state.variant_name = null;
        state.version_number = null;
        state.design_id = null;
        state.design_code = null;
        state.design_name = null;
        state.design_variant_status = null;
        state.design_status = null;
        state.total_shares = 0;
        state.lastQueriedVariantId = Number(action.meta.arg.variantId);
        state.lastFetchedTimestamp = Date.now();
      })
      .addCase(fetchDesignVariantManufacturerShares.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        if (Array.isArray(payload)) {
          state.shares = payload;
          state.total_shares = payload.length;
          state.variant_id = null;
          state.variant_name = null;
          state.version_number = null;
          state.design_id = null;
          state.design_code = null;
          state.design_name = null;
          state.design_variant_status = null;
          state.design_status = null;
        } else {
          state.shares = payload?.shares || [];
          state.variant_id = payload?.variant_id;
          state.variant_name = payload?.variant_name;
          state.version_number = payload?.version_number;
          state.design_id = payload?.design_id;
          state.design_code = payload?.design_code;
          state.design_name = payload?.design_name;
          state.design_variant_status = payload?.design_variant_status;
          state.design_status = payload?.design_status;
          state.total_shares = payload?.total_shares || 0;
        }
        state.lastQueriedVariantId = Number(action.meta.arg.variantId);
      })
      .addCase(fetchDesignVariantManufacturerShares.rejected, (state, action) => {
        state.loading = false;
        if (action.payload === 'canceled') {
          return;
        }
        state.error = action.payload ?? 'Unknown error';
        state.shares = [];
        state.variant_id = null;
        state.variant_name = null;
        state.version_number = null;
        state.design_id = null;
        state.design_code = null;
        state.design_name = null;
        state.design_variant_status = null;
        state.design_status = null;
        state.total_shares = 0;
        state.lastQueriedVariantId = Number(action.meta.arg.variantId);
      });
  },
});

export const { resetSharesState } = designVariantManufacturerSharesSlice.actions;
export default designVariantManufacturerSharesSlice.reducer;
