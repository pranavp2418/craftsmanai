import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface RestoreDesignPayload {
  designId: string | number;
}

export interface RestoreDesignResponse {
  id: number;
  message: string;
}

interface RestoreDesignState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: RestoreDesignResponse | null;
}

const initialState: RestoreDesignState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const restoreDesign = createAsyncThunk<
  RestoreDesignResponse,
  RestoreDesignPayload,
  { rejectValue: string }
>(
  'retailer/analytics/designRestore/restore',
  async ({ designId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(
        `/api/v2/design/${designId}/restore`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      return response.data as RestoreDesignResponse;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to restore design.';
      return rejectWithValue(message);
    }
  }
);

const designRestoreSlice = createSlice({
  name: 'retailerDesignRestore',
  initialState,
  reducers: {
    resetDesignRestore(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(restoreDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(restoreDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetDesignRestore } = designRestoreSlice.actions;
export default designRestoreSlice.reducer;
