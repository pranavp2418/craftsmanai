import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface CompleteDesignPayload {
  designId: string | number;
}

export interface CompleteDesignResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface CompleteDesignState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: CompleteDesignResponse | null;
}

const initialState: CompleteDesignState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const completeDesign = createAsyncThunk<
  CompleteDesignResponse,
  CompleteDesignPayload,
  { rejectValue: string }
>(
  'retailer/designComplete',
  async ({ designId }, { rejectWithValue }) => {
    try {
      console.info('[CompleteDesign] API request', {
        url: `/api/v2/design/${designId}/complete`,
      });
      const response = await axiosInstance.patch(
        `/api/v2/design/${designId}/complete`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      console.info('[CompleteDesign] API response', response.data);
      return response.data as CompleteDesignResponse;
    } catch (error: any) {
      console.error('[CompleteDesign] API error', error);
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to mark design complete.';
      return rejectWithValue(message);
    }
  }
);

const designCompleteSlice = createSlice({
  name: 'retailerDesignComplete',
  initialState,
  reducers: {
    resetDesignComplete(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(completeDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(completeDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(completeDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetDesignComplete } = designCompleteSlice.actions;
export default designCompleteSlice.reducer;
