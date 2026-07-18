import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface ArchiveDesignPayload {
  designId: string | number;
}

export interface ArchiveDesignResponse {
  success?: boolean;
  message?: string;
  [key: string]: unknown;
}

interface ArchiveDesignState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: ArchiveDesignResponse | null;
}

const initialState: ArchiveDesignState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

export const archiveDesign = createAsyncThunk<
  ArchiveDesignResponse,
  ArchiveDesignPayload,
  { rejectValue: string }
>(
  'retailer/designArchive/archive',
  async ({ designId }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.patch(
        `/api/v2/design/${designId}/archive`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      return response.data as ArchiveDesignResponse;
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to archive design.';
      return rejectWithValue(message);
    }
  }
);

const designArchiveSlice = createSlice({
  name: 'retailerDesignArchive',
  initialState,
  reducers: {
    resetDesignArchive(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(archiveDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(archiveDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
      })
      .addCase(archiveDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
        state.success = false;
      });
  },
});

export const { resetDesignArchive } = designArchiveSlice.actions;
export default designArchiveSlice.reducer;
