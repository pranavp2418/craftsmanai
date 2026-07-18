import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import { shareVariant } from '@/redux/slices/retailer/designVariantShareSlice';
import { shareVariantWithManufacturer } from '@/redux/slices/retailer/designVariantShareMfgSlice';

export interface DesignApiItem {
  id: number;
  user_id: number;
  design_code: string;
  sequence_number: number;
  name: string;
  jewellery_type: string;
  user_prompt: string;
  input_image_url: string | null;
  input_image_urls: string[] | null;
  status: string;
  created_at: string;
  updated_at: string;
  variants?: any[];
  shared_customer?: any;
}

export interface DesignsResponse {
  items: DesignApiItem[];
  total: number;
}

export interface FetchDesignsParams {
  status?: string;
  search?: string;
  limit?: number;
  page?: number;
  append?: boolean;
  selectedDesignId?: string | number | null;
}

interface DesignsState {
  items: DesignApiItem[];
  total: number;
  loading: boolean;
  singleLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

const initialState: DesignsState = {
  items: [],
  total: 0,
  loading: false,
  singleLoading: false,
  error: null,
  hasMore: true,
};

export const fetchDesigns = createAsyncThunk<
  DesignsResponse,
  FetchDesignsParams | void,
  { rejectValue: string }
>(
  'retailer/designs/fetch',
  async (params, { rejectWithValue }) => {
    try {
      const query: any = {
        status: params?.status,
        search: params?.search,
        limit: params?.limit,
        page: params?.page,
      };
      if (params?.selectedDesignId) {
        query.selected_design_id = params.selectedDesignId;
      }
      const response = await axiosInstance.get('/api/v2/design/', {
        params: query,
        withCredentials: false,
      });
      const data = response.data;
      if (Array.isArray(data)) {
        return { items: data, total: data.length } as DesignsResponse;
      }
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
          ? data.results
          : [];
      const total =
        typeof data?.total === 'number'
          ? data.total
          : typeof data?.count === 'number'
            ? data.count
            : items.length;
      return { items, total } as DesignsResponse;
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to fetch designs.';
      return rejectWithValue(message);
    }
  }
);

export const fetchDesignByIdOrCode = createAsyncThunk<
  DesignApiItem | null,
  { idOrCode: string | number },
  { rejectValue: string }
>(
  'retailer/designs/fetchSingle',
  async ({ idOrCode }, { rejectWithValue }) => {
    try {
      // 1. Try to fetch as a variant ID if it is numeric
      if (!isNaN(Number(idOrCode))) {
        try {
          const variantRes = await axiosInstance.get(`/api/v2/design-variant/variants/${idOrCode}`);
          if (variantRes.data && variantRes.data.design_id) {
            const designId = variantRes.data.design_id;
            const detailRes = await axiosInstance.get(`/api/v2/design/${designId}`);
            if (detailRes.data && detailRes.data.id) {
              return detailRes.data;
            }
          }
        } catch (e) {
          // Ignore and continue
        }
      }

      // 2. Try to search for the specific design_code or ID using the search query parameter
      const response = await axiosInstance.get('/api/v2/design/', {
        params: { search: String(idOrCode).trim(), limit: 10 },
      });
      const data = response.data;
      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.results)
            ? data.results
            : [];
      
      const exactMatch = items.find((item: any) => 
        String(item.id) === String(idOrCode) || 
        (item.design_code && idOrCode && String(item.design_code).toLowerCase() === String(idOrCode).toLowerCase())
      );
      if (exactMatch) {
        try {
          const detailRes = await axiosInstance.get(`/api/v2/design/${exactMatch.id}`);
          if (detailRes.data && detailRes.data.id) {
            return detailRes.data;
          }
        } catch (e) {
          // Ignore and fallback to exactMatch
        }
        return exactMatch;
      }

      // 3. Fallback: If not found in search results, attempt direct GET by numeric ID (if idOrCode is numeric)
      if (!isNaN(Number(idOrCode))) {
        try {
          const detailRes = await axiosInstance.get(`/api/v2/design/${idOrCode}`);
          if (detailRes.data && detailRes.data.id) {
            return detailRes.data;
          }
        } catch (e) {
          // Ignore detail fetch error
        }
      }
      return null;
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to fetch design details.';
      return rejectWithValue(message);
    }
  }
);

const designsSlice = createSlice({
  name: 'retailerDesigns',
  initialState,
  reducers: {
    resetDesigns(state) {
      state.items = [];
      state.total = 0;
      state.loading = false;
      state.error = null;
      state.hasMore = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDesigns.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDesigns.fulfilled, (state, action) => {
        state.loading = false;
        const fetchedItems = action.payload.items || [];
        const limit = action.meta.arg?.limit ?? 16;

        const append = action.meta.arg?.append ?? false;
        const selectedDesignId = action.meta.arg?.selectedDesignId;
        if (append) {
          const existingIds = new Set(state.items.map((item) => item.id));
          const newItems = fetchedItems.filter((item) => !existingIds.has(item.id));
          if (newItems.length === 0) {
            state.hasMore = false;
            state.total = state.items.length;
          } else {
            state.items = [...state.items, ...newItems];
            state.hasMore = fetchedItems.length === limit;
            state.total = action.payload.total ?? 0;
          }
        } else {
          const fetchedIds = new Set(fetchedItems.map((item) => item.id));
          const itemsToKeep = state.items.filter((item) => {
            const statusUpper = (item.status || '').trim().toUpperCase();
            const isGenerating = statusUpper === 'GENERATING' || statusUpper === 'PENDING' || statusUpper === 'PROCESSING';
            const isSelected = selectedDesignId && (
              String(item.id) === String(selectedDesignId) ||
              (item.design_code && String(item.design_code).toLowerCase() === String(selectedDesignId).toLowerCase())
            );
            return !fetchedIds.has(item.id) && (isGenerating || isSelected);
          });
          state.items = [...itemsToKeep, ...fetchedItems];
          state.hasMore = fetchedItems.length === limit;
          state.total = (action.payload.total ?? 0) + itemsToKeep.length;
        }
      })
      .addCase(fetchDesigns.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      })
      .addCase(fetchDesignByIdOrCode.pending, (state) => {
        state.singleLoading = true;
      })
      .addCase(fetchDesignByIdOrCode.fulfilled, (state, action) => {
        state.singleLoading = false;
        const item = action.payload;
        if (item) {
          const exists = state.items.some((existing) => existing.id === item.id);
          if (!exists) {
            state.items = [item, ...state.items];
            state.total = state.total + 1;
          } else {
            // Update the existing item to ensure we have the fresh status and variants list!
            state.items = state.items.map((existing) => 
              existing.id === item.id ? item : existing
            );
          }
        }
      })
      .addCase(fetchDesignByIdOrCode.rejected, (state) => {
        state.singleLoading = false;
      })
      .addCase(shareVariant.fulfilled, (state, action) => {
        const variantId = action.meta.arg?.variantId;
        if (variantId) {
          state.items = state.items.map((item) => {
            const hasVariant = item.variants?.some((v: any) => String(v.id) === String(variantId));
            if (hasVariant) {
              return { ...item, status: 'SHARED' };
            }
            return item;
          });
        }
      })
      .addCase(shareVariantWithManufacturer.fulfilled, (state, action) => {
        const variantId = action.meta.arg?.variantId;
        if (variantId) {
          state.items = state.items.map((item) => {
            const hasVariant = item.variants?.some((v: any) => String(v.id) === String(variantId));
            if (hasVariant) {
              return { ...item, status: 'SENT_TO_MANUFACTURER' };
            }
            return item;
          });
        }
      });
  },
});

export const { resetDesigns } = designsSlice.actions;
export default designsSlice.reducer;
