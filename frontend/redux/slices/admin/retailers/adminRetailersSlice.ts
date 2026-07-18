import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import type { Retailer } from '@/app/admin/retailers/components/RetailerTable';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FetchRetailersParams {
    page?: number;
    limit?: number;
    status?: string;
    subfilter?: string;
    search?: string;
}

interface PaginationMeta {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
}

interface FetchRetailersResult {
    retailers: Retailer[];
    pagination: PaginationMeta;
}

interface AdminRetailersState {
    retailers: Retailer[];
    pagination: PaginationMeta;
    loading: boolean;
    error: string | null;
    // Status update
    updateStatusLoading: boolean;
    updateStatusError: string | null;
    // Delete retailer
    deleteLoading: boolean;
    deleteError: string | null;
}

// ─── Initial State ─────────────────────────────────────────────────────────────

const initialState: AdminRetailersState = {
    retailers: [],
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
    updateStatusLoading: false,
    updateStatusError: null,
    deleteLoading: false,
    deleteError: null,
};

// ─── Normalizer ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeRetailer(raw: any): Retailer {
    const apiStatus = String(raw.status ?? '').toUpperCase();
    const status: 'active' | 'disabled' =
        apiStatus === 'ACTIVE' ? 'active' : 'disabled';

    const joinedDate = raw.created_at
        ? new Date(raw.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : '';

    return {
        id: String(raw.id ?? ''),
        name: String(raw.full_name ?? raw.name ?? ''),
        retailerId: String(raw.id ?? '').slice(0, 8).toUpperCase(),
        email: String(raw.email ?? ''),
        contactNumber: String(raw.phone ?? raw.contact_number ?? ''),
        status,
        totalRequests: Number(raw.total_requests ?? 0),
        activeRequests: Number(raw.active_requests ?? 0),
        completedRequests: Number(raw.completed_requests ?? 0),
        associatedManufacturers: Number(raw.associated_manufacturers ?? 0),
        subscriptionAmount: raw.subscription_amount != null ? Number(raw.subscription_amount) : null,
        joinedDate,
    };
}

// ─── Async Thunk ───────────────────────────────────────────────────────────────

/**
 * GET /api/v2/admin/retailers/
 * Fetch paginated list of retailers for the superadmin.
 */
export const fetchAdminRetailers = createAsyncThunk<
    FetchRetailersResult,
    FetchRetailersParams | void,
    { rejectValue: string }
>(
    'admin/retailers/fetchAll',
    async (arg, { rejectWithValue }) => {
        try {
            const page  = (arg as FetchRetailersParams)?.page  ?? 1;
            const limit = (arg as FetchRetailersParams)?.limit ?? 20;
            const status = (arg as FetchRetailersParams)?.status;
            const subfilter = (arg as FetchRetailersParams)?.subfilter;
            const search = (arg as FetchRetailersParams)?.search;

            // Build query params — only include optional params if they have a value
            const queryParams: Record<string, string | number> = { page, limit };
            if (status && status !== 'all') queryParams.status = status;
            if (subfilter) queryParams.subfilter = subfilter;
            if (search) queryParams.search = search;

            const response = await axiosInstance.get('/api/v2/admin/retailers/', {
                params: queryParams,
            });

            const data = response.data;

            // Support both { retailers: [...], pagination: {...} } and flat array
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawList: any[] = Array.isArray(data?.retailers)
                ? data.retailers
                : Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data)
                ? data
                : [];

            const pagination: PaginationMeta = {
                page:        data?.pagination?.page        ?? page,
                limit:       data?.pagination?.limit       ?? limit,
                total_items: data?.pagination?.total_items ?? rawList.length,
                total_pages: data?.pagination?.total_pages ?? 1,
                has_next:    data?.pagination?.has_next    ?? false,
                has_prev:    data?.pagination?.has_prev    ?? false,
            };

            return {
                retailers: rawList.map(normalizeRetailer),
                pagination,
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
                  'Failed to fetch retailers.';
            return rejectWithValue(message);
        }
    }
);

/**
 * POST /api/v2/admin/retailers/update-status
 * Enable or disable a retailer.
 */
export const updateRetailerStatus = createAsyncThunk<
    { retailer_id: string; status: 'ACTIVE' | 'INACTIVE' | 'DISABLED' },
    { retailer_id: string; status: 'ACTIVE' | 'INACTIVE' | 'DISABLED' },
    { rejectValue: string }
>(
    'admin/retailers/updateStatus',
    async (payload, { rejectWithValue }) => {
        try {
            await axiosInstance.post('/api/v2/admin/retailers/update-status', payload);
            return payload;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            const detail = error?.response?.data?.detail;
            const message = Array.isArray(detail)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
                : detail ||
                  error?.response?.data?.message ||
                  error?.message ||
                  'Failed to update retailer status.';
            return rejectWithValue(message);
        }
    }
);

// Permanently delete a retailer and ALL their data (admin-only, irreversible).
export const deleteRetailer = createAsyncThunk<
    { retailer_id: string },
    { retailer_id: string },
    { rejectValue: string }
>(
    'admin/retailers/delete',
    async (payload, { rejectWithValue }) => {
        try {
            await axiosInstance.post('/api/v2/admin/retailers/delete', payload);
            return payload;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            const detail = error?.response?.data?.detail;
            const message = Array.isArray(detail)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
                : detail ||
                  error?.response?.data?.message ||
                  error?.message ||
                  'Failed to delete retailer.';
            return rejectWithValue(message);
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminRetailersSlice = createSlice({
    name: 'adminRetailers',
    initialState,
    reducers: {
        resetAdminRetailers(state) {
            state.retailers = [];
            state.pagination = initialState.pagination;
            state.loading = false;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAdminRetailers.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAdminRetailers.fulfilled, (state, action) => {
                state.loading = false;
                state.retailers = action.payload.retailers;
                state.pagination = action.payload.pagination;
            })
            .addCase(fetchAdminRetailers.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? 'Unknown error';
            })
            // update status
            .addCase(updateRetailerStatus.pending, (state) => {
                state.updateStatusLoading = true;
                state.updateStatusError = null;
            })
            .addCase(updateRetailerStatus.fulfilled, (state, action) => {
                state.updateStatusLoading = false;
                // Update the retailer's status in local list immediately
                const { retailer_id, status } = action.payload;
                const retailer = state.retailers.find((r) => r.id === retailer_id);
                if (retailer) {
                    retailer.status = status === 'ACTIVE' ? 'active' : 'disabled';
                }
            })
            .addCase(updateRetailerStatus.rejected, (state, action) => {
                state.updateStatusLoading = false;
                state.updateStatusError = action.payload ?? 'Unknown error';
            })
            // delete retailer
            .addCase(deleteRetailer.pending, (state) => {
                state.deleteLoading = true;
                state.deleteError = null;
            })
            .addCase(deleteRetailer.fulfilled, (state, action) => {
                state.deleteLoading = false;
                // Optimistically drop the row; the page also refetches the list.
                const { retailer_id } = action.payload;
                state.retailers = state.retailers.filter((r) => r.id !== retailer_id);
            })
            .addCase(deleteRetailer.rejected, (state, action) => {
                state.deleteLoading = false;
                state.deleteError = action.payload ?? 'Unknown error';
            });
    },
});

export const { resetAdminRetailers } = adminRetailersSlice.actions;
export default adminRetailersSlice.reducer;
