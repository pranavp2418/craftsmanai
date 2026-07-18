import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface ArchivedDesignItem {
  id: number;
  user_id: number;
  created_by_user_id: number;
  design_code: string;
  sequence_number: number;
  name: string;
  jewellery_type: string;
  user_prompt: string;
  input_image_url: string;
  input_image_urls: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ArchivedPagination {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ArchivedDesignsResponse {
  items: ArchivedDesignItem[];
  total: number;
  pagination: ArchivedPagination;
}

interface ArchivedDesignsState {
  items: ArchivedDesignItem[];
  total: number;
  pagination: ArchivedPagination | null;
  loading: boolean;
  error: string | null;
}

const initialState: ArchivedDesignsState = {
  items: [],
  total: 0,
  pagination: null,
  loading: false,
  error: null,
};

export const fetchArchivedDesigns = createAsyncThunk<
  ArchivedDesignsResponse,
  { page?: number; limit?: number },
  { rejectValue: string }
>(
  'retailer/analytics/archived/fetch',
  async ({ page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/design/archived', {
        params: {
          page: Math.floor(Number(page)),
          limit: Math.floor(Number(limit)),
        },
      });
      return response.data as ArchivedDesignsResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to fetch archived requests.';
      return rejectWithValue(message);
    }
  },
  {
    condition: ({ page = 1, limit = 10 }, { getState }) => {
      const state = getState() as any;
      const { loading } = state.retailerAnalyticsArchived;
      if (loading) {
        return false;
      }
    },
  }
);

const archivedSlice = createSlice({
  name: 'retailerAnalyticsArchived',
  initialState,
  reducers: {
    resetArchivedDesigns(state) {
      state.items = [];
      state.total = 0;
      state.pagination = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchArchivedDesigns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchArchivedDesigns.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || [];
        state.total = action.payload.total ?? 0;
        state.pagination = action.payload.pagination || null;
      })
      .addCase(fetchArchivedDesigns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetArchivedDesigns } = archivedSlice.actions;
export default archivedSlice.reducer;
