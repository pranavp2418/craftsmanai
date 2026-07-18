import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

interface AdminManufacturerEnableState {
  loading: boolean;
  error: string | null;
  successId: string | null;
}

const initialState: AdminManufacturerEnableState = {
  loading: false,
  error: null,
  successId: null,
};

export const enableManufacturer = createAsyncThunk(
  'adminManufacturerEnable/enable',
  async (manufacturerId: string, { rejectWithValue }) => {
    try {
      await axiosInstance.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v2/admin/manufacturers/${manufacturerId}/enable`
      );
      return manufacturerId;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to enable manufacturer'
      );
    }
  }
);

const adminManufacturerEnableSlice = createSlice({
  name: 'adminManufacturerEnable',
  initialState,
  reducers: {
    resetEnableState(state) {
      state.loading = false;
      state.error = null;
      state.successId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(enableManufacturer.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successId = null;
      })
      .addCase(enableManufacturer.fulfilled, (state, action) => {
        state.loading = false;
        state.successId = action.payload;
      })
      .addCase(enableManufacturer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetEnableState } = adminManufacturerEnableSlice.actions;
export default adminManufacturerEnableSlice.reducer;
