import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface EditJewellerySubtypePayload {
  subtype_id: string;
  type_id: string;
  label: string;
  status: 'active' | 'disabled';
  image?: File | null;
}

interface AdminJewellerySubtypeEditState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AdminJewellerySubtypeEditState = {
  loading: false,
  error: null,
  success: false,
};

export const editJewellerySubtype = createAsyncThunk(
  'adminJewellerySubtypeEdit/edit',
  async (payload: EditJewellerySubtypePayload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('type_id', payload.type_id);
      formData.append('label', payload.label);
      formData.append('status', payload.status);
      if (payload.image) {
        formData.append('image', payload.image);
      } else {
        formData.append('image', '');
      }

      await axiosInstance.put(
        `/api/v2/admin/jewellery/subtypes/${payload.subtype_id}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return payload.subtype_id;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[]; message?: string } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) return rejectWithValue(detail.map((d) => d.msg).join(', '));
      if (typeof detail === 'string') return rejectWithValue(detail);
      return rejectWithValue(error?.response?.data?.message ?? 'Failed to update jewellery subtype');
    }
  }
);

const adminJewellerySubtypeEditSlice = createSlice({
  name: 'adminJewellerySubtypeEdit',
  initialState,
  reducers: {
    resetJewellerySubtypeEdit(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(editJewellerySubtype.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(editJewellerySubtype.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(editJewellerySubtype.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetJewellerySubtypeEdit } = adminJewellerySubtypeEditSlice.actions;
export default adminJewellerySubtypeEditSlice.reducer;
