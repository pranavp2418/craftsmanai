import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface ApproveDesignPayload {
  token: string;
}

export interface ApproveDesignResponse {
  success: boolean;
  message?: string;
  [key: string]: any;
}

interface ApproveDesignState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

const initialState: ApproveDesignState = {
  loading: false,
  success: false,
  error: null,
};

export const approveDesign = createAsyncThunk<
  ApproveDesignResponse,
  ApproveDesignPayload,
  { rejectValue: string }
>(
  'retailer/designApprove/approve',
  async ({ token }, { rejectWithValue }) => {
    try {
      console.info('[ApproveDesign] API request', { token });
      const response = await axiosInstance.post(
        `/api/v2/public/approve`,
        { token },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      console.info('[ApproveDesign] API response', response.data);
      return response.data as ApproveDesignResponse;
    } catch (error: any) {
      console.error('[ApproveDesign] API error', error);
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to approve design.';
      return rejectWithValue(message);
    }
  }
);

const designVariantApproveSlice = createSlice({
  name: 'retailerDesignVariantApprove',
  initialState,
  reducers: {
    resetApproveState(state) {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(approveDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(approveDesign.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(approveDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetApproveState } = designVariantApproveSlice.actions;
export default designVariantApproveSlice.reducer;
