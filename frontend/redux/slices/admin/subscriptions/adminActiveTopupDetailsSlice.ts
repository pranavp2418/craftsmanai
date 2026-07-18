import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface AdminActiveTopupDetails {
  [key: string]: any;
}

interface AdminActiveTopupDetailsState {
  data: AdminActiveTopupDetails | null;
  loading: boolean;
  error: string | null;
}

const initialState: AdminActiveTopupDetailsState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchActiveTopupDetails = createAsyncThunk<
  AdminActiveTopupDetails,
  string | number,
  { rejectValue: string }
>('adminActiveTopupDetails/fetch', async (retailerId, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.get(
      `/api/v2/admin/subscription-plans/active-topups/${retailerId}`,
    );

    const root = response.data;
    return (root?.data ?? root) as AdminActiveTopupDetails;
  } catch (error) {
    return rejectWithValue(formatApiError(error));
  }
});

const adminActiveTopupDetailsSlice = createSlice({
  name: 'adminActiveTopupDetails',
  initialState,
  reducers: {
    clearActiveTopupDetails(state) {
      state.data = null;
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActiveTopupDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchActiveTopupDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchActiveTopupDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch active top-up details.';
      });
  },
});

export const { clearActiveTopupDetails } = adminActiveTopupDetailsSlice.actions;
export default adminActiveTopupDetailsSlice.reducer;
