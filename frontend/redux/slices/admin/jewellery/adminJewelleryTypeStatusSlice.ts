import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import { AdminJewelleryType } from './adminJewelleryTypesSlice';

interface ToggleJewelleryTypeStatusPayload {
  type_id: string;
  status: 'active' | 'disabled';
}

interface AdminJewelleryTypeStatusState {
  loading: boolean;
  error: string | null;
  updatedType: AdminJewelleryType | null;
}

const initialState: AdminJewelleryTypeStatusState = {
  loading: false,
  error: null,
  updatedType: null,
};

export const toggleJewelleryTypeStatus = createAsyncThunk(
  'adminJewelleryTypeStatus/toggle',
  async (payload: ToggleJewelleryTypeStatusPayload, { rejectWithValue }) => {
    try {
      const body = new URLSearchParams();
      body.append('status', payload.status);
      const response = await axiosInstance.patch(
        `/api/v2/admin/jewellery/types/${payload.type_id}/status`,
        body,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const item: any = response.data?.data ?? response.data;
      const baseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
      const rawImage: string = item.image ?? item.image_url ?? '';
      const normalized: AdminJewelleryType = {
        id: item.id ?? item._id ?? '',
        name: item.name ?? item.label ?? '',
        status: item.status === 'active' ? 'active' : 'disabled',
        image: rawImage ? `${baseUrl}/${rawImage.replace(/\\/g, '/')}` : '',
      };
      return normalized;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[]; message?: string } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) return rejectWithValue(detail.map((d) => d.msg).join(', '));
      if (typeof detail === 'string') return rejectWithValue(detail);
      return rejectWithValue(error?.response?.data?.message ?? 'Failed to update jewelery type status');
    }
  }
);

const adminJewelleryTypeStatusSlice = createSlice({
  name: 'adminJewelleryTypeStatus',
  initialState,
  reducers: {
    resetJewelleryTypeStatus(state) {
      state.loading = false;
      state.error = null;
      state.updatedType = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(toggleJewelleryTypeStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.updatedType = null;
      })
      .addCase(toggleJewelleryTypeStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.updatedType = action.payload;
      })
      .addCase(toggleJewelleryTypeStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetJewelleryTypeStatus } = adminJewelleryTypeStatusSlice.actions;
export default adminJewelleryTypeStatusSlice.reducer;
