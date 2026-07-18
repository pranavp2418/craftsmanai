import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface ArchiveVariantPayload {
  variantId: string | number;
}

export interface ArchiveVariantResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface ArchiveVariantState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: ArchiveVariantResponse | null;
}

const initialState: ArchiveVariantState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const archiveVariant = createAsyncThunk<
  ArchiveVariantResponse,
  ArchiveVariantPayload,
  { rejectValue: string }
>(
  'retailer/designVariantArchive/archive',
  async ({ variantId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(
        `/api/v2/design-variant/variants/${variantId}/archive`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      return response.data as ArchiveVariantResponse;
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to archive variant.';
      return rejectWithValue(message);
    }
  }
);

const designVariantArchiveSlice = createSlice({
  name: 'retailerDesignVariantArchive',
  initialState,
  reducers: {
    resetVariantArchive(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(archiveVariant.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(archiveVariant.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(archiveVariant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetVariantArchive } = designVariantArchiveSlice.actions;
export default designVariantArchiveSlice.reducer;
