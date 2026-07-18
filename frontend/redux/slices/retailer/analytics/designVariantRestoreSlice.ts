import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface RestoreVariantPayload {
  variantId: string | number;
}

export interface RestoreVariantResponse {
  id: number;
  message: string;
}

interface RestoreVariantState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: RestoreVariantResponse | null;
}

const initialState: RestoreVariantState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const restoreVariant = createAsyncThunk<
  RestoreVariantResponse,
  RestoreVariantPayload,
  { rejectValue: string }
>(
  'retailer/analytics/designVariantRestore/restore',
  async ({ variantId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(
        `/api/v2/design-variant/variants/${variantId}/restore`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      return response.data as RestoreVariantResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to restore variant.';
      return rejectWithValue(message);
    }
  }
);

const designVariantRestoreSlice = createSlice({
  name: 'retailerDesignVariantRestore',
  initialState,
  reducers: {
    resetVariantRestore(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreVariant.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(restoreVariant.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(restoreVariant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetVariantRestore } = designVariantRestoreSlice.actions;
export default designVariantRestoreSlice.reducer;
