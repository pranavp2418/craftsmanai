import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import type { RequestStatusRecord, RequestStatus } from '@/app/admin/dashboard/components/RequestStatusTable';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FetchRequestStatusParams {
  status?: string;
  retailer_id?: string;
  customer_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface AdminRequestStatusState {
  requests: RequestStatusRecord[];
  pagination: PaginationMeta;
  loading: boolean;
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map API status codes → display labels used by RequestStatusTable */
function mapStatus(raw: string | null): RequestStatus {
  const map: Record<string, RequestStatus> = {
    // @ts-ignore
    APPROVED:                'Customer Approved',
    PENDING:                 'Quote Requested',
    QUOTE_REQUESTED:         'Quote Requested',
    IN_PROGRESS:             'Quotation in Progress',
    IN_PRODUCTION:           'In Production',
    PRODUCTION:              'In Production',
    GENERATED:               'Generated',
    SENT_TO_MANUFACTURER:    'In Production',
    MANUFACTURER_APPROVED:   'Manufacturer Approved',
    COMPLETED:               'Production Completed',
    DONE:                    'Production Completed',
    REFINEMENT:              'Refinement Requested',
    REFINEMENT_REQUESTED:    'Refinement Requested',
    DETECTED:                'Detected',
  };
  return map[raw?.toUpperCase() ?? ''] ?? 'Quote Requested';
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  if (raw.includes('T')) {
    const parts = raw.split('T');
    if (parts.length === 2) {
      const date = parts[0];
      const time = parts[1].slice(0, 5);
      return `${date} ${time}`;
    }
  }
  return raw.slice(0, 10);
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminRequestStatusState = {
  requests: [],
  pagination: {
    page: 1,
    limit: 20,
    total_items: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  },
  loading: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const fetchAdminRequestStatus = createAsyncThunk<
  { requests: RequestStatusRecord[]; pagination: PaginationMeta },
  FetchRequestStatusParams | void,
  { rejectValue: string }
>(
  'adminRequestStatus/fetch',
  async (arg, { rejectWithValue }) => {
    try {
      const params = (arg as FetchRequestStatusParams) ?? {};
      const { page = 1, limit = 20, status, retailer_id, customer_id, search } = params;

      // Build query params — only include optional params if they have a value
      const queryParams: Record<string, string | number> = { page, limit };
      if (status && status !== 'all') queryParams.status = status;
      if (retailer_id && retailer_id !== 'all') queryParams.retailer_id = retailer_id;
      if (customer_id && customer_id !== 'all') queryParams.customer_id = customer_id;
      if (search) queryParams.search = search;

      const response = await axiosInstance.get('/api/v2/admin/dashboard/request_status/details', {
        params: queryParams,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = response.data;
      const raw: any[] = data?.data ?? data?.requests ?? data ?? [];
      const pg = data?.pagination ?? {};

      const requests = raw.map((item) => ({
        id:            item.request_id ?? item.id ?? '',
        requestId:     item.request_id ?? item.id ?? '',
        jewelleryType: item.jewellery_type ?? '—',
        currentStatus: mapStatus(item.current_status),
        retailer:      item.retailer ?? '—',
        customer:      item.customer ?? '—',
        createdDate:   formatDate(item.created_at),
        lastUpdated:   formatDate(item.last_updated),
      })) as RequestStatusRecord[];

      const pagination: PaginationMeta = {
        page:        pg.page ?? page,
        limit:       pg.limit ?? limit,
        total_items: pg.total_items ?? pg.totalItems ?? raw.length,
        total_pages: pg.total_pages ?? pg.totalPages ?? 1,
        has_next:    pg.has_next ?? pg.hasNext ?? false,
        has_prev:    pg.has_prev ?? pg.hasPrev ?? false,
      };

      return { requests, pagination };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail || error?.response?.data?.message || error?.message || 'Failed to fetch request status details.';
      return rejectWithValue(message);
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminRequestStatusSlice = createSlice({
  name: 'adminRequestStatus',
  initialState,
  reducers: {
    clearRequestStatus(state) {
      state.requests = [];
      state.pagination = initialState.pagination;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminRequestStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminRequestStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.requests = action.payload.requests;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAdminRequestStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { clearRequestStatus } = adminRequestStatusSlice.actions;
export default adminRequestStatusSlice.reducer;
