import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface ArchivedVariantItem {
  id: number;
  design_id: number;
  parent_variant_id: number | null;
  variant_name: string;
  version_number: number;
  base_design_image_url: string;
}

export interface ArchivedVersionsPagination {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ArchivedVersionsResponse {
  items: ArchivedVariantItem[];
  pagination: ArchivedVersionsPagination;
  total?: number;
  total_items?: number;
}

interface ArchivedVersionsState {
  items: ArchivedVariantItem[];
  total: number;
  pagination: ArchivedVersionsPagination | null;
  loading: boolean;
  error: string | null;
}

const initialState: ArchivedVersionsState = {
  items: [],
  total: 0,
  pagination: null,
  loading: false,
  error: null,
};

export const fetchArchivedVersions = createAsyncThunk<
  ArchivedVersionsResponse,
  { page?: number; limit?: number },
  { rejectValue: string }
>(
  'retailer/analytics/archivedVersions/fetch',
  async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/design-variant/archived', {
        params: {
          page: Math.floor(Number(page)),
          limit: Math.floor(Number(limit)),
        },
      });
      return response.data as ArchivedVersionsResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to fetch archived versions.';
      return rejectWithValue(message);
    }
  },
  {
    condition: ({ page = 1, limit = 20 }, { getState }) => {
      const state = getState() as any;
      const { loading } = state.retailerAnalyticsArchivedVersions;
      if (loading) {
        return false;
      }
    },
  }
);

const archivedVersionsSlice = createSlice({
  name: 'retailerAnalyticsArchivedVersions',
  initialState,
  reducers: {
    resetArchivedVersions(state) {
      state.items = [];
      state.total = 0;
      state.pagination = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchArchivedVersions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArchivedVersions.fulfilled, (state, action) => {
        state.loading = false;
        const newItems = action.payload.items || [];
        const existingIds = new Set(state.items.map((i) => i.id));
        const filteredNew = newItems.filter((i) => !existingIds.has(i.id));
        state.items = [...state.items, ...filteredNew];
        state.total = action.payload.pagination?.total_items ?? action.payload.total_items ?? action.payload.total ?? state.items.length;
        state.pagination = action.payload.pagination || null;
      })
      .addCase(fetchArchivedVersions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetArchivedVersions } = archivedVersionsSlice.actions;
export default archivedVersionsSlice.reducer;
