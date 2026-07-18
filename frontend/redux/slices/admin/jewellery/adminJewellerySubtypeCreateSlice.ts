import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface CreateJewellerySubtypePayload {
  type_id: string;
  label: string;
  status: 'active' | 'disabled';
}

interface AdminJewellerySubtypeCreateState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AdminJewellerySubtypeCreateState = {
  loading: false,
  error: null,
  success: false,
};

export const createJewellerySubtype = createAsyncThunk(
  'adminJewellerySubtypeCreate/create',
  async (payload: CreateJewellerySubtypePayload, { rejectWithValue }) => {
    try {
      const body = new URLSearchParams();
      body.append('type_id', payload.type_id);
      body.append('label', payload.label);
      body.append('status', payload.status);

      const response = await axiosInstance.post(
        `/api/v2/admin/jewellery/subtypes`,
        body,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      return response.data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[]; message?: string } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) return rejectWithValue(detail.map((d) => d.msg).join(', '));
      if (typeof detail === 'string') return rejectWithValue(detail);
      return rejectWithValue(error?.response?.data?.message ?? 'Failed to create jewelery subtype');
    }
  }
);

const adminJewellerySubtypeCreateSlice = createSlice({
  name: 'adminJewellerySubtypeCreate',
  initialState,
  reducers: {
    resetJewellerySubtypeCreate(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createJewellerySubtype.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createJewellerySubtype.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(createJewellerySubtype.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetJewellerySubtypeCreate } = adminJewellerySubtypeCreateSlice.actions;
export default adminJewellerySubtypeCreateSlice.reducer;
