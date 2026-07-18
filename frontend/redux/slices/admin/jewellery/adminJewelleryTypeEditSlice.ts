import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface EditJewelleryTypePayload {
  type_id: string;
  label: string;
  status: 'active' | 'disabled';
  image?: File | null;
}

interface AdminJewelleryTypeEditState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AdminJewelleryTypeEditState = {
  loading: false,
  error: null,
  success: false,
};

export const editJewelleryType = createAsyncThunk(
  'adminJewelleryTypeEdit/edit',
  async (payload: EditJewelleryTypePayload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('label', payload.label);
      formData.append('status', payload.status);
      if (payload.image) {
        formData.append('image', payload.image);
      }
      const response = await axiosInstance.put(
        `/api/v2/admin/jewellery/types/${payload.type_id}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[]; message?: string } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) return rejectWithValue(detail.map((d) => d.msg).join(', '));
      if (typeof detail === 'string') return rejectWithValue(detail);
      return rejectWithValue(error?.response?.data?.message ?? 'Failed to update jewelery type');
    }
  }
);

const adminJewelleryTypeEditSlice = createSlice({
  name: 'adminJewelleryTypeEdit',
  initialState,
  reducers: {
    resetJewelleryTypeEdit(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(editJewelleryType.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(editJewelleryType.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(editJewelleryType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetJewelleryTypeEdit } = adminJewelleryTypeEditSlice.actions;
export default adminJewelleryTypeEditSlice.reducer;
