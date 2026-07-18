import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface RejectDesignPayload {
  token: string;
}

export interface RejectDesignResponse {
  success: boolean;
  message?: string;
  [key: string]: any;
}

interface RejectDesignState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

const initialState: RejectDesignState = {
  loading: false,
  success: false,
  error: null,
};

export const rejectDesign = createAsyncThunk<
  RejectDesignResponse,
  RejectDesignPayload,
  { rejectValue: string }
>(
  'retailer/designReject/reject',
  async ({ token }, { rejectWithValue }) => {
    try {
      console.info('[RejectDesign] API request', { token });
      const response = await axiosInstance.post(
        `/api/v2/public/reject`,
        { token },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      console.info('[RejectDesign] API response', response.data);
      return response.data as RejectDesignResponse;
    } catch (error: any) {
      console.error('[RejectDesign] API error', error);
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to reject design.';
      return rejectWithValue(message);
    }
  }
);

const designVariantRejectSlice = createSlice({
  name: 'retailerDesignVariantReject',
  initialState,
  reducers: {
    resetRejectState(state) {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(rejectDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(rejectDesign.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(rejectDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetRejectState } = designVariantRejectSlice.actions;
export default designVariantRejectSlice.reducer;
