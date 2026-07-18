import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

interface AdminManufacturerDisableState {
  loading: boolean;
  error: string | null;
  successId: string | null;
}

const initialState: AdminManufacturerDisableState = {
  loading: false,
  error: null,
  successId: null,
};

export const disableManufacturer = createAsyncThunk(
  'adminManufacturerDisable/disable',
  async (manufacturerId: string, { rejectWithValue }) => {
    try {
      await axiosInstance.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/manufacturers/${manufacturerId}/disable`
      );
      return manufacturerId;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to disable manufacturer'
      );
    }
  }
);

const adminManufacturerDisableSlice = createSlice({
  name: 'adminManufacturerDisable',
  initialState,
  reducers: {
    resetDisableState(state) {
      state.loading = false;
      state.error = null;
      state.successId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(disableManufacturer.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successId = null;
      })
      .addCase(disableManufacturer.fulfilled, (state, action) => {
        state.loading = false;
        state.successId = action.payload;
      })
      .addCase(disableManufacturer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetDisableState } = adminManufacturerDisableSlice.actions;
export default adminManufacturerDisableSlice.reducer;
