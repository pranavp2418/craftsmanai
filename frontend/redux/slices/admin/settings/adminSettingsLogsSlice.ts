import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface AdminSettingsLog {
  id: string;
  change: string;
  user: string;
  time: string;
  rawTime: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface AdminSettingsLogsState {
  logs: AdminSettingsLog[];
  pagination: PaginationMeta;
  loading: boolean;
  error: string | null;
}

const initialState: AdminSettingsLogsState = {
  logs: [],
  pagination: {
    page: 1,
    limit: 10,
    total_items: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  },
  loading: false,
  error: null,
};

const toDisplayTime = (value: unknown): string => {
  if (!value) return '-';
  const raw = String(value);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const base = date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Chicago',
  });
  return `${base}`;
};

const humanizeFieldName = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeValue = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (text.toLowerCase() === 'true') return 'Enabled';
  if (text.toLowerCase() === 'false') return 'Disabled';
  return text;
};

const isBooleanLike = (value: unknown): boolean => {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === 'false' || text === 'enabled' || text === 'disabled';
};

const parseLogItem = (item: Record<string, unknown>, index: number): AdminSettingsLog => {
  const rawTime = String(
    item.updated_at ?? item.changed_at ?? item.created_at ?? item.timestamp ?? ''
  );

  const user = String(
    item.changed_by_name ??
    item.changed_by ??
    item.updated_by_name ??
    item.updated_by ??
    item.user_name ??
    item.user ??
    item.admin_id ??
    'System'
  );

  const explicitMessage = item.message ?? item.change_message ?? item.description;
  const fieldName =
    item.changed_field ?? item.field_name ?? item.setting_key ?? item.key ?? item.field;
  const oldValue = item.old_value ?? item.previous_value;
  const newValue = item.new_value ?? item.current_value ?? item.value;

  let change = '';
  if (explicitMessage) {
    change = String(explicitMessage);
  } else if (fieldName && oldValue !== undefined && newValue !== undefined) {
    if (isBooleanLike(oldValue) && isBooleanLike(newValue)) {
      change = `${humanizeFieldName(String(fieldName))} ${normalizeValue(newValue)}`;
    } else {
      change = `${humanizeFieldName(String(fieldName))} changed from ${normalizeValue(oldValue)} to ${normalizeValue(newValue)}`;
    }
  } else if (fieldName && newValue !== undefined) {
    change = `${humanizeFieldName(String(fieldName))} set to ${normalizeValue(newValue)}`;
  } else {
    change = 'Settings updated';
  }

  return {
    id: String(item.id ?? item.log_id ?? `${rawTime}-${index}`),
    change,
    user,
    time: toDisplayTime(rawTime),
    rawTime,
  };
};

export const fetchAdminSettingsLogs = createAsyncThunk<
  { logs: AdminSettingsLog[]; pagination: PaginationMeta },
  { page?: number; limit?: number } | void,
  { rejectValue: string }
>('admin/settings/fetchAdminSettingsLogs', async (params, { rejectWithValue }) => {
  try {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const response = await axiosInstance.get('/api/v2/admin/settings/logs', {
      params: { page, limit },
    });
    const data = response.data;
    const raw = data?.data ?? data;

    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.logs)
            ? raw.logs
            : [];

    const logs = list
      .map((item: unknown, index: number) => {
        const safeItem = (item ?? {}) as Record<string, unknown>;
        return parseLogItem(safeItem, index);
      })
      .sort((a: AdminSettingsLog, b: AdminSettingsLog) => {
        const t1 = a.rawTime ? new Date(a.rawTime).getTime() : 0;
        const t2 = b.rawTime ? new Date(b.rawTime).getTime() : 0;
        return t2 - t1;
      });

    const pg = data?.pagination ?? raw?.pagination ?? {};
    const pagination: PaginationMeta = {
      page: pg.page ?? data?.page ?? raw?.page ?? page,
      limit: pg.limit ?? data?.limit ?? raw?.limit ?? limit,
      total_items: pg.total_items ?? pg.totalItems ?? data?.total ?? raw?.total ?? data?.total_items ?? (Array.isArray(list) ? list.length : 0),
      total_pages: pg.total_pages ?? pg.totalPages ?? data?.total_pages ?? raw?.total_pages ?? 1,
      has_next: pg.has_next ?? pg.hasNext ?? data?.has_next ?? raw?.has_next ?? false,
      has_prev: pg.has_prev ?? pg.hasPrev ?? data?.has_prev ?? raw?.has_prev ?? false,
    };

    return { logs, pagination };
  } catch (error: unknown) {
    const err = error as { response?: { data?: { detail?: string; message?: string } }; message?: string };
    return rejectWithValue(
      err.response?.data?.detail ??
      err.response?.data?.message ??
      err.message ??
      'Failed to fetch admin settings logs'
    );
  }
});

const adminSettingsLogsSlice = createSlice({
  name: 'adminSettingsLogs',
  initialState,
  reducers: {
    resetAdminSettingsLogsState: (state) => {
      state.logs = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminSettingsLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminSettingsLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.logs = action.payload.logs;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchAdminSettingsLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch admin settings logs';
      });
  },
});

export const { resetAdminSettingsLogsState } = adminSettingsLogsSlice.actions;
export default adminSettingsLogsSlice.reducer;
