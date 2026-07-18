import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import axios from 'axios';

export interface DesignShare {
  customer_name: string | null;
  email: string | null;
  shared_on: string | null;
  status: string | null;
  customer_comment_or_feedback: string | null;
  token?: string | null;
}

interface DesignSharesState {
  shares: DesignShare[];
  loading: boolean;
  error: string | null;
}

const initialState: DesignSharesState = {
  shares: [],
  loading: false,
  error: null,
};

export const fetchDesignShares = createAsyncThunk<
  DesignShare[],
  { variantId: string | number },
  { rejectValue: string }
>(
  'retailer/designShares/fetchList',
  async ({ variantId }, { rejectWithValue, signal }) => {
    try {
      console.info('[FetchDesignShares] API request', {
        url: `/api/v2/customer/${variantId}/design_shares`,
      });
      const response = await axiosInstance.get(
        `/api/v2/customer/${variantId}/design_shares`,
        { signal }
      );
      console.info('[FetchDesignShares] API response', response.data);
      return response.data as DesignShare[];
    } catch (error: any) {
      if (axios.isCancel(error)) {
        return rejectWithValue('canceled');
      }
      const is404 = error?.response?.status === 404;
      if (!is404) {
        console.error('[FetchDesignShares] API error', error);
      }
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to fetch design shares.';
      return rejectWithValue(message);
    }
  }
);

const designVariantSharesSlice = createSlice({
  name: 'retailerDesignVariantShares',
  initialState,
  reducers: {
    resetSharesState(state) {
      state.shares = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDesignShares.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.shares = [];
      })
      .addCase(fetchDesignShares.fulfilled, (state, action) => {
        state.loading = false;
        state.shares = action.payload || [];
      })
      .addCase(fetchDesignShares.rejected, (state, action) => {
        state.loading = false;
        if (action.payload === 'canceled') {
          return;
        }
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetSharesState } = designVariantSharesSlice.actions;
export default designVariantSharesSlice.reducer;
