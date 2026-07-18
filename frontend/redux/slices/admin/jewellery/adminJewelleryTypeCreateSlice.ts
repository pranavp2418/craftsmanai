import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface CreateJewelleryTypePayload {
  label: string;
  status: 'active' | 'disabled';
  image?: File | null;
}

interface AdminJewelleryTypeCreateState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AdminJewelleryTypeCreateState = {
  loading: false,
  error: null,
  success: false,
};

export const createJewelleryType = createAsyncThunk(
  'adminJewelleryTypeCreate/create',
  async (payload: CreateJewelleryTypePayload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('label', payload.label);
      formData.append('status', payload.status);
      if (payload.image) {
        formData.append('image', payload.image);
      }
      const response = await axiosInstance.post(
        '/api/v2/admin/jewellery/type_create',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[]; message?: string } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) return rejectWithValue(detail.map((d) => d.msg).join(', '));
      if (typeof detail === 'string') return rejectWithValue(detail);
      return rejectWithValue(error?.response?.data?.message ?? 'Failed to create jewelery type');
    }
  }
);

const adminJewelleryTypeCreateSlice = createSlice({
  name: 'adminJewelleryTypeCreate',
  initialState,
  reducers: {
    resetJewelleryTypeCreate(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createJewelleryType.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createJewelleryType.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(createJewelleryType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetJewelleryTypeCreate } = adminJewelleryTypeCreateSlice.actions;
export default adminJewelleryTypeCreateSlice.reducer;
