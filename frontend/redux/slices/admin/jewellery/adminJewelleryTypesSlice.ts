import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface AdminJewelleryType {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  image: string;
}

interface AdminJewelleryTypesState {
  types: AdminJewelleryType[];
  loading: boolean;
  error: string | null;
}

const initialState: AdminJewelleryTypesState = {
  types: [],
  loading: false,
  error: null,
};

export const fetchAdminJewelleryTypes = createAsyncThunk(
  'adminJewelleryTypes/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/admin/jewellery/types');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = response.data?.data ?? response.data ?? [];
      const baseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/$/, '');
      const types: AdminJewelleryType[] = raw.map((item) => {
        const rawImage: string = item.image ?? item.image_url ?? '';
        const image = rawImage
          ? `${baseUrl}/${rawImage.replace(/\\/g, '/')}`
          : '';
        return {
          id: item.id ?? item._id ?? String(item.value ?? ''),
          name: item.name ?? item.label ?? '',
          status: item.status === 'active' || item.is_active === true ? 'active' : 'disabled',
          image,
        };
      });
      return types;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[]; message?: string } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) return rejectWithValue(detail.map((d) => d.msg).join(', '));
      if (typeof detail === 'string') return rejectWithValue(detail);
      return rejectWithValue(error?.response?.data?.message ?? 'Failed to fetch jewellery types');
    }
  }
);

const adminJewelleryTypesSlice = createSlice({
  name: 'adminJewelleryTypes',
  initialState,
  reducers: {
    clearJewelleryTypes(state) {
      state.types = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminJewelleryTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminJewelleryTypes.fulfilled, (state, action) => {
        state.loading = false;
        state.types = action.payload;
      })
      .addCase(fetchAdminJewelleryTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearJewelleryTypes } = adminJewelleryTypesSlice.actions;
export default adminJewelleryTypesSlice.reducer;
