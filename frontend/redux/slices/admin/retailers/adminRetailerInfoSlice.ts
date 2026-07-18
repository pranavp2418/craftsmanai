import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetailerInfo {
    id: string;
    name: string;
    retailerId: string;
    email: string;
    contactNumber: string;
    status: 'active' | 'disabled';
    totalRequests: number;
    activeRequests: number;
    completedRequests: number;
    associatedManufacturers: number;
    joinedDate: string;
    lastActive: string | null;
}

// A single render under a design — the base (v0) or a refine (v1, v2, …).
export interface HistoryVariant {
    variant_id: number;
    version: number | null;
    label: string;              // "Base" | "Refine 1" | …
    output_image: string | null;
    prompt: string | null;
    reference_images: string[];
    created_at: string | null;
}

// One generation (design) in the retailer's history — its inputs + all its variants.
export interface RetailerHistoryItem {
    design_id: number;
    design_code: string | null;
    name: string | null;
    jewellery_type: string | null;
    prompt: string | null;          // original create prompt
    input_images: string[];         // ALL uploaded input images
    status: string | null;
    created_at: string | null;
    variants: HistoryVariant[];     // base + all refines
}

export interface HistoryPagination {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
}

interface AdminRetailerInfoState {
    info: RetailerInfo | null;
    loading: boolean;
    error: string | null;
    // Generation history
    history: RetailerHistoryItem[];
    historyLoading: boolean;
    historyError: string | null;
    historyPagination: HistoryPagination;
}

// ─── Initial State ─────────────────────────────────────────────────────────────

const initialHistoryPagination: HistoryPagination = {
    page: 1,
    limit: 10,
    total_items: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false,
};

const initialState: AdminRetailerInfoState = {
    info: null,
    loading: false,
    error: null,
    history: [],
    historyLoading: false,
    historyError: null,
    historyPagination: initialHistoryPagination,
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRetailerInfo(raw: any): RetailerInfo {
    // Response shape: { retailer: {...}, stats: {...} }
    const retailer = raw?.retailer ?? raw;
    const stats    = raw?.stats    ?? {};

    const apiStatus = String(retailer.status ?? '').toUpperCase();
    const status: 'active' | 'disabled' =
        apiStatus === 'ACTIVE' ? 'active' : 'disabled';

    const joinedDate = retailer.created_at
        ? new Date(retailer.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : '';

    return {
        id: String(retailer.id ?? ''),
        name: String(retailer.full_name ?? retailer.name ?? ''),
        retailerId: String(retailer.id ?? '').slice(0, 8).toUpperCase(),
        email: String(retailer.email ?? ''),
        contactNumber: String(retailer.phone ?? retailer.contact_number ?? ''),
        status,
        totalRequests:           Number(stats.total_requests      ?? retailer.total_requests      ?? 0),
        activeRequests:          Number(stats.active_requests     ?? retailer.active_requests     ?? 0),
        completedRequests:       Number(stats.completed_requests  ?? retailer.completed_requests  ?? 0),
        associatedManufacturers: Number(stats.associated_manufacturers ?? retailer.associated_manufacturers ?? 0),
        joinedDate,
        lastActive: retailer.last_active ?? null,
    };
}

// ─── Async Thunk ───────────────────────────────────────────────────────────────

/**
 * POST /api/v2/admin/retailers/info
 * Fetch detailed info of a specific retailer by ID.
 */
export const fetchAdminRetailerInfo = createAsyncThunk<
    RetailerInfo,
    string,             // retailer id
    { rejectValue: string }
>(
    'admin/retailers/fetchInfo',
    async (retailerId, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.post('/api/v2/admin/retailers/info', {
                retailer_id: retailerId,
            });

            const raw = response.data?.data ?? response.data;
            return normalizeRetailerInfo(raw);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            const detail = error?.response?.data?.detail;
            const message = Array.isArray(detail)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
                : detail ||
                  error?.response?.data?.message ||
                  error?.message ||
                  'Failed to fetch retailer info.';
            return rejectWithValue(message);
        }
    }
);

/**
 * POST /api/v2/admin/retailers/history
 * A retailer's generation history — input image(s), output image, prompt, date — newest first.
 */
export const fetchRetailerHistory = createAsyncThunk<
    { history: RetailerHistoryItem[]; pagination: HistoryPagination },
    { retailer_id: string; page?: number; limit?: number },
    { rejectValue: string }
>(
    'admin/retailers/fetchHistory',
    async ({ retailer_id, page = 1, limit = 10 }, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.post('/api/v2/admin/retailers/history', {
                retailer_id,
                page,
                limit,
            });
            const raw = response.data?.data ?? response.data;
            return {
                history: (raw?.history ?? []) as RetailerHistoryItem[],
                pagination: (raw?.pagination ?? initialHistoryPagination) as HistoryPagination,
            };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            const detail = error?.response?.data?.detail;
            const message = Array.isArray(detail)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
                : detail ||
                  error?.response?.data?.message ||
                  error?.message ||
                  'Failed to fetch retailer history.';
            return rejectWithValue(message);
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminRetailerInfoSlice = createSlice({
    name: 'adminRetailerInfo',
    initialState,
    reducers: {
        clearRetailerInfo(state) {
            state.info = null;
            state.loading = false;
            state.error = null;
            state.history = [];
            state.historyLoading = false;
            state.historyError = null;
            state.historyPagination = initialHistoryPagination;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAdminRetailerInfo.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.info = null;
            })
            .addCase(fetchAdminRetailerInfo.fulfilled, (state, action) => {
                state.loading = false;
                state.info = action.payload;
            })
            .addCase(fetchAdminRetailerInfo.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? 'Unknown error';
            })
            // generation history
            .addCase(fetchRetailerHistory.pending, (state) => {
                state.historyLoading = true;
                state.historyError = null;
            })
            .addCase(fetchRetailerHistory.fulfilled, (state, action) => {
                state.historyLoading = false;
                state.history = action.payload.history;
                state.historyPagination = action.payload.pagination;
            })
            .addCase(fetchRetailerHistory.rejected, (state, action) => {
                state.historyLoading = false;
                state.historyError = action.payload ?? 'Unknown error';
            });
    },
});

export const { clearRetailerInfo } = adminRetailerInfoSlice.actions;
export default adminRetailerInfoSlice.reducer;
