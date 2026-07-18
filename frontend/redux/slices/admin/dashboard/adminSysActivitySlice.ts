import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import type { ActivityRecord } from '@/app/admin/dashboard/components/RecentActivityTable';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FetchSysActivityParams {
  actor_type?: string;
  actor_id?: string;
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

interface AdminSysActivityState {
  activities: ActivityRecord[];
  pagination: PaginationMeta;
  loading: boolean;
  error: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert "JEWELLERY_TYPE_CREATED" → "Jewellery type created" */
function formatAction(raw: string): string {
  return raw
    .toLowerCase()
    .split('_')
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** Format ISO timestamp → "YYYY-MM-DD HH:MM" */
function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  if (iso.includes('T')) {
    const parts = iso.split('T');
    if (parts.length === 2) {
      const date = parts[0];
      const time = parts[1].slice(0, 5);
      return `${date} ${time}`;
    }
  }
  return iso;
}

/** Map API actor_type to ActivityRecord actorType */
function mapActorType(raw: string): ActivityRecord['actorType'] {
  const map: Record<string, ActivityRecord['actorType']> = {
    ADMIN: 'Admin',
    RETAILER: 'Retailer',
    MANUFACTURER: 'Manufacturer',
    CUSTOMER: 'Customer',
  };
  return map[raw?.toUpperCase()] ?? 'System';
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminSysActivityState = {
  activities: [],
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

export const fetchAdminSysActivity = createAsyncThunk<
  { activities: ActivityRecord[]; pagination: PaginationMeta },
  FetchSysActivityParams | void,
  { rejectValue: string }
>(
  'adminSysActivity/fetch',
  async (arg, { rejectWithValue }) => {
    try {
      const params = (arg as FetchSysActivityParams) ?? {};
      const { page = 1, limit = 20, actor_type, actor_id, search } = params;

      // Build query params — only include optional params if they have a value
      const queryParams: Record<string, string | number> = { page, limit };
      if (actor_type && actor_type !== 'all') queryParams.actor_type = actor_type;
      if (actor_id && actor_id !== 'all') queryParams.actor_id = actor_id;
      if (search) queryParams.search = search;

      const response = await axiosInstance.get('/api/v2/admin/dashboard/admin_sys_activity/', {
        params: queryParams,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = response.data;
      const raw: any[] = data?.data ?? data?.activities ?? data ?? [];
      const pg = data?.pagination ?? {};

      const activities = raw.map((item) => ({
        id: item.id ?? '',
        timestamp: formatTimestamp(item.timestamp ?? ''),
        actorType: mapActorType(item.actor_type ?? ''),
        actor: item.actor_name ?? 'System',
        action: formatAction(item.action ?? ''),
        referenceId: item.reference_id ?? '',
      })) as ActivityRecord[];

      const pagination: PaginationMeta = {
        page:        pg.page ?? page,
        limit:       pg.limit ?? limit,
        total_items: pg.total_items ?? pg.totalItems ?? raw.length,
        total_pages: pg.total_pages ?? pg.totalPages ?? 1,
        has_next:    pg.has_next ?? pg.hasNext ?? false,
        has_prev:    pg.has_prev ?? pg.hasPrev ?? false,
      };

      return { activities, pagination };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail || error?.response?.data?.message || error?.message || 'Failed to fetch system activity.';
      return rejectWithValue(message);
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminSysActivitySlice = createSlice({
  name: 'adminSysActivity',
  initialState,
  reducers: {
    clearSysActivity(state) {
      state.activities = [];
      state.pagination = initialState.pagination;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminSysActivity.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminSysActivity.fulfilled, (state, action) => {
        state.loading = false;
        state.activities = action.payload.activities;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAdminSysActivity.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { clearSysActivity } = adminSysActivitySlice.actions;
export default adminSysActivitySlice.reducer;
