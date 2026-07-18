import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminDashboardStats {
    total_retailers: number;
    active_manufacturers: number;
    total_customers: number;
    active_requests: number;
    pending_approvals: number;
}

interface AdminDashboardState {
    stats: AdminDashboardStats | null;
    loading: boolean;
    error: string | null;
}

// ─── Initial State ─────────────────────────────────────────────────────────────

const initialState: AdminDashboardState = {
    stats: null,
    loading: false,
    error: null,
};

// ─── Async Thunk ───────────────────────────────────────────────────────────────

/**
 * GET /api/v2/admin/dashboard/stats/
 * Fetches platform-wide stats for the superadmin dashboard.
 */
export const fetchAdminDashboardStats = createAsyncThunk<
    AdminDashboardStats,
    void,
    { rejectValue: string }
>(
    'admin/dashboard/fetchStats',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.get('/api/v2/admin/dashboard/stats/');

            // Support both { data: {...} } and flat response shapes
            const raw = response.data?.data ?? response.data;

            return {
                total_retailers:      Number(raw?.totalRetailers      ?? raw?.total_retailers      ?? raw?.retailers      ?? 0),
                active_manufacturers: Number(raw?.activeManufacturers ?? raw?.active_manufacturers ?? raw?.manufacturers  ?? 0),
                total_customers:      Number(raw?.totalCustomers      ?? raw?.total_customers      ?? raw?.customers      ?? 0),
                active_requests:      Number(raw?.activeRequests      ?? raw?.active_requests      ?? raw?.requests       ?? 0),
                pending_approvals:    Number(raw?.pendingApprovals    ?? raw?.pending_approvals    ?? raw?.approvals      ?? 0),
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
                  'Failed to fetch admin dashboard stats.';
            return rejectWithValue(message);
        }
    }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminDashboardSlice = createSlice({
    name: 'adminDashboard',
    initialState,
    reducers: {
        resetAdminDashboardStats(state) {
            state.stats = null;
            state.loading = false;
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAdminDashboardStats.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAdminDashboardStats.fulfilled, (state, action) => {
                state.loading = false;
                state.stats = action.payload;
            })
            .addCase(fetchAdminDashboardStats.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload ?? 'Unknown error';
            });
    },
});

export const { resetAdminDashboardStats } = adminDashboardSlice.actions;
export default adminDashboardSlice.reducer;
