import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface AdminActiveTopupUser {
  [key: string]: any;
}

interface FetchActiveTopupsParams {
  planName?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface AdminActiveTopupsState {
  items: AdminActiveTopupUser[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: string | null;
}

interface ActiveTopupsResponse {
  items: AdminActiveTopupUser[];
  total: number;
  page: number;
  limit: number;
}

const initialState: AdminActiveTopupsState = {
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  loading: false,
  error: null,
};

const toNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const fetchActiveTopups = createAsyncThunk<
  ActiveTopupsResponse,
  FetchActiveTopupsParams | void,
  { rejectValue: string }
>('adminActiveTopups/fetch', async (args, { rejectWithValue, getState }) => {
  try {
    const page = Math.max(1, toNumber(args?.page, 1));
    const limit = Math.min(100, Math.max(1, toNumber(args?.limit, 10)));

    const params: Record<string, string | number> = {
      page,
      limit,
    };

    const planName = args?.planName?.trim();
    if (planName && planName.toLowerCase() !== 'all') {
      params.plan_name = planName;
    }

    const search = args?.search?.trim();
    if (search) {
      params.search = search;
    }

    const response = await axiosInstance.get('/api/v2/admin/subscription-plans/active-topups', {
      params,
    });

    const root = response.data;
    const data = root?.data ?? root;

    const items = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.rows)
            ? data.rows
            : [];

    const total = toNumber(
      data?.total ??
        data?.total_count ??
        data?.count ??
        data?.pagination?.total ??
        data?.meta?.total,
      items.length,
    );

    const currentPage = Math.max(
      1,
      toNumber(data?.page ?? data?.pagination?.page ?? data?.meta?.page, page),
    );

    const currentLimit = Math.min(
      100,
      Math.max(1, toNumber(data?.limit ?? data?.pagination?.limit ?? data?.meta?.limit, limit)),
    );

    return {
      items,
      total,
      page: currentPage,
      limit: currentLimit,
    };
  } catch (error) {
    return rejectWithValue(formatApiError(error));
  }
}, {
  condition: (_, { getState }) => {
    // This helps with debouncing but the main logic is in requestId comparison
    return true;
  }
});

const adminActiveTopupsSlice = createSlice({
  name: 'adminActiveTopups',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveTopups.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.items = []; // Clear items on new fetch to prevent stale data display
      })
      .addCase(fetchActiveTopups.fulfilled, (state, action) => {
        state.loading = false;
        
        // Deduplicate items by retailer_id to prevent duplicate rows
        const seen = new Set<string>();
        const uniqueItems = action.payload.items.filter((item: any) => {
          const id = String(item?.retailer_id ?? item?.id ?? item?.user_id);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        
        state.items = uniqueItems;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
      })
      .addCase(fetchActiveTopups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch active top-up users.';
      });
  },
});

export default adminActiveTopupsSlice.reducer;
