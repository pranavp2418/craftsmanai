import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface DeleteVariantPayload {
  variantId: string | number;
}

export interface DeleteVariantResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface DeleteVariantState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: DeleteVariantResponse | null;
}

const initialState: DeleteVariantState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const deleteVariant = createAsyncThunk<
  DeleteVariantResponse,
  DeleteVariantPayload,
  { rejectValue: string }
>(
  'retailer/designVariantDelete/delete',
  async ({ variantId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(`/api/v2/design-variant/variants/${variantId}`);
      return response.data as DeleteVariantResponse;
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to delete variant.';
      return rejectWithValue(message);
    }
  }
);

const designVariantDeleteSlice = createSlice({
  name: 'retailerDesignVariantDelete',
  initialState,
  reducers: {
    resetVariantDelete(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(deleteVariant.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(deleteVariant.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(deleteVariant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetVariantDelete } = designVariantDeleteSlice.actions;
export default designVariantDeleteSlice.reducer;
