import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface DeleteDesignPayload {
  designId: string | number;
}

export interface DeleteDesignResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface DeleteDesignState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: DeleteDesignResponse | null;
}

const initialState: DeleteDesignState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const deleteDesign = createAsyncThunk<
  DeleteDesignResponse,
  DeleteDesignPayload,
  { rejectValue: string }
>(
  'retailer/designDelete/delete',
  async ({ designId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(`/api/v2/design/${designId}`);
      return response.data as DeleteDesignResponse;
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to delete design.';
      return rejectWithValue(message);
    }
  }
);

const designDeleteSlice = createSlice({
  name: 'retailerDesignDelete',
  initialState,
  reducers: {
    resetDesignDelete(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(deleteDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(deleteDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(deleteDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetDesignDelete } = designDeleteSlice.actions;
export default designDeleteSlice.reducer;
