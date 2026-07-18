import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface FetchDesignByIdParams {
  designId: string | number;
}

interface DesignDetailState {
  data: any[];
  loading: boolean;
  error: string | null;
}

const initialState: DesignDetailState = {
  data: [],
  loading: false,
  error: null,
};

export const fetchDesignById = createAsyncThunk<
  any[],
  FetchDesignByIdParams,
  { rejectValue: string }
>(
  'retailer/designDetail/fetch',
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
          'Failed to fetch design.';
      return rejectWithValue(message);
    }
  }
);

const designDetailSlice = createSlice({
  name: 'retailerDesignDetail',
  initialState,
  reducers: {
    resetDesignDetail(state) {
      state.loading = false;
      state.error = null;
      state.data = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDesignById.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.data = []; // Clear previous data so UI doesn't show old variants
      })
      .addCase(fetchDesignById.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchDesignById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetDesignDetail } = designDetailSlice.actions;
export default designDetailSlice.reducer;
