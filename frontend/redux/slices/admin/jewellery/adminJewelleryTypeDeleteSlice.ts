import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

interface DeleteJewelleryTypeState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: DeleteJewelleryTypeState = {
  loading: false,
  error: null,
  success: false,
};

export const deleteJewelleryType = createAsyncThunk(
  'adminJewelleryTypeDelete/delete',
  async (type_id: string, { rejectWithValue }) => {
    try {
      await axiosInstance.delete(`/api/v2/admin/jewellery/type/${type_id}`);
      return type_id;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[]; message?: string } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) return rejectWithValue(detail.map((d) => d.msg).join(', '));
      if (typeof detail === 'string') return rejectWithValue(detail);
      return rejectWithValue(error?.response?.data?.message ?? 'Failed to delete jewellery type');
    }
  }
);

const adminJewelleryTypeDeleteSlice = createSlice({
  name: 'adminJewelleryTypeDelete',
  initialState,
  reducers: {
    resetJewelleryTypeDelete(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(deleteJewelleryType.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(deleteJewelleryType.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(deleteJewelleryType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetJewelleryTypeDelete } = adminJewelleryTypeDeleteSlice.actions;
export default adminJewelleryTypeDeleteSlice.reducer;
