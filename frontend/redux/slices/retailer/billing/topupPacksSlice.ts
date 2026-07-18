import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface TopupPack {
  id: string;
  renders: number;
  price: number;
}

interface TopupPacksState {
  items: TopupPack[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: TopupPacksState = {
  items: [],
  status: 'idle',
  error: null,
};

export const fetchTopupPacks = createAsyncThunk<
  TopupPack[],
  { onlyActive?: boolean } | void,
  { rejectValue: string }
>(
  'retailer/billing/fetchTopupPacks',
  async (params, { rejectWithValue }) => {
    try {
      const onlyActive = params && typeof params === 'object' ? Boolean(params.onlyActive) : false;
      const response = await axiosInstance.get('/api/v2/retailer/subscriptions/topup-packs', {
        params: {
          only_active: onlyActive,
        },
      });
      if (response.data && Array.isArray(response.data.data)) {
        return response.data.data as TopupPack[];
      } else if (Array.isArray(response.data)) {
        return response.data as TopupPack[];
      }
      return [];
    } catch (error: any) {
      return rejectWithValue(formatApiError(error) || 'Failed to load top-up packs.');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { status } = state.retailerTopupPacks;
      if (status === 'loading') {
        return false;
      }
    },
  }
);

const topupPacksSlice = createSlice({
  name: 'retailerTopupPacks',
  initialState,
  reducers: {
    resetTopupPacksState: (state) => {
      state.status = 'idle';
      state.error = null;
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTopupPacks.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchTopupPacks.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchTopupPacks.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load top-up packs.';
      });
  },
});

export const { resetTopupPacksState } = topupPacksSlice.actions;
export default topupPacksSlice.reducer;
