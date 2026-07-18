import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

interface ToggleJewellerySubtypeStatusPayload {
  subtype_id: string;
  status: 'active' | 'disabled';
}

interface AdminJewellerySubtypeStatusState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AdminJewellerySubtypeStatusState = {
  loading: false,
  error: null,
  success: false,
};

export const toggleJewellerySubtypeStatus = createAsyncThunk(
  'adminJewellerySubtypeStatus/toggle',
  async (payload: ToggleJewellerySubtypeStatusPayload, { rejectWithValue }) => {
    try {
      const body = new URLSearchParams();
      body.append('status', payload.status);
      await axiosInstance.patch(
        `/api/v2/admin/jewellery/subtypes/${payload.subtype_id}/status`,
        body,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      return payload;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[]; message?: string } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) return rejectWithValue(detail.map((d) => d.msg).join(', '));
      if (typeof detail === 'string') return rejectWithValue(detail);
      return rejectWithValue(error?.response?.data?.message ?? 'Failed to update subtype status');
    }
  }
);

const adminJewellerySubtypeStatusSlice = createSlice({
  name: 'adminJewellerySubtypeStatus',
  initialState,
  reducers: {
    resetJewellerySubtypeStatus(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(toggleJewellerySubtypeStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(toggleJewellerySubtypeStatus.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(toggleJewellerySubtypeStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetJewellerySubtypeStatus } = adminJewellerySubtypeStatusSlice.actions;
export default adminJewellerySubtypeStatusSlice.reducer;
