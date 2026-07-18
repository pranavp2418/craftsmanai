import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import formatApiError from '@/src/utils/formatApiError';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CancellationRecord {
  id: string;
  retailer_id: string;
  retailer_name: string;
  plan_name: string;
  cancellation_date: string;
  cancellation_reason: string;
  status: string;
}

interface FetchCancellationRecordsParams {
  search?: string;
  reason?: string;
  page?: number;
  limit?: number;
}

interface AdminCancellationRecordsState {
  records: CancellationRecord[];
  total: number;
  page: number;
  limit: number;
  loading: boolean;
  error: string | null;
}

interface CancellationRecordsResponse {
  records: CancellationRecord[];
  total: number;
  page: number;
  limit: number;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminCancellationRecordsState = {
  records: [],
  total: 0,
  page: 1,
  limit: 10,
  loading: false,
  error: null,
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const toNumber = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchCancellationRecords = createAsyncThunk<
  CancellationRecordsResponse,
  FetchCancellationRecordsParams | void,
  { rejectValue: string }
>(
  'adminCancellationRecords/fetch',
  async (args, { rejectWithValue }) => {
    try {
      const page = Math.max(1, toNumber(args?.page, 1));
      const limit = Math.min(100, Math.max(1, toNumber(args?.limit, 10)));

      const params: Record<string, string | number> = {
        page,
        limit,
      };

      const search = args?.search?.trim();
      if (search) {
        params.search = search;
      }

      const reason = args?.reason?.trim();
      if (reason && reason.toLowerCase() !== 'all') {
        params.reason = reason;
      }

      const response = await axiosInstance.get(
        '/api/v2/admin/subscription-plans/cancellation-insights/list',
        { params }
      );

      const root = response.data;
      const data = root?.data ?? root;

      const records = Array.isArray(data)
        ? data
        : Array.isArray(data?.records)
          ? data.records
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.results)
              ? data.results
              : [];

      const total = toNumber(
        data?.total ??
          data?.total_count ??
          data?.count ??
          data?.pagination?.total ??
          data?.meta?.total,
        records.length
      );

      const currentPage = Math.max(
        1,
        toNumber(data?.page ?? data?.pagination?.page ?? data?.meta?.page, page)
      );

      const currentLimit = Math.min(
        100,
        Math.max(1, toNumber(data?.limit ?? data?.pagination?.limit ?? data?.meta?.limit, limit))
      );

      return {
        records,
        total,
        page: currentPage,
        limit: currentLimit,
      };
    } catch (error) {
      return rejectWithValue(formatApiError(error));
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminCancellationRecordsSlice = createSlice({
  name: 'adminCancellationRecords',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCancellationRecords.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCancellationRecords.fulfilled, (state, action) => {
        state.loading = false;
        state.records = action.payload.records;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
      })
      .addCase(fetchCancellationRecords.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch cancellation records.';
      });
  },
});

export default adminCancellationRecordsSlice.reducer;
