import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateRetailerPayload {
  email: string;
  name: string;
  phone: string;
  password: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface AdminCreateRetailerState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminCreateRetailerState = {
  loading: false,
  error: null,
  success: false,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const createRetailer = createAsyncThunk<
  void,
  CreateRetailerPayload,
  { rejectValue: string }
>(
  'adminCreateRetailer/create',
  async (payload, { rejectWithValue }) => {
    try {
      await axiosInstance.post('/api/v2/admin/retailers/retailers', payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to create retailer.';
      return rejectWithValue(message);
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminCreateRetailerSlice = createSlice({
  name: 'adminCreateRetailer',
  initialState,
  reducers: {
    resetCreateRetailer(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createRetailer.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createRetailer.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(createRetailer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetCreateRetailer } = adminCreateRetailerSlice.actions;
export default adminCreateRetailerSlice.reducer;
