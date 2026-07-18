import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import { JewelrySubtype } from '@/app/admin/jewelleryconfig/components/jewellrySubtype';

interface AdminJewellerySubtypesState {
  subtypes: JewelrySubtype[];
  loading: boolean;
  error: string | null;
}

const initialState: AdminJewellerySubtypesState = {
  subtypes: [],
  loading: false,
  error: null,
};

export const fetchAdminJewellerySubtypes = createAsyncThunk(
  'adminJewellerySubtypes/fetch',
  async (type: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `/api/v2/admin/jewellery/subtypes`,
        { params: { type } }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const list: any[] = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

      const normalized: JewelrySubtype[] = list.map((item) => ({
        id: item.id ?? item._id ?? item.label ?? '',
        name: item.name ?? item.label ?? '',
        status: item.status === 'active' ? 'active' : 'disabled',
        quizCount: item.quiz_count ?? item.quizCount ?? 0,
      }));
      return normalized;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[]; message?: string } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) return rejectWithValue(detail.map((d) => d.msg).join(', '));
      if (typeof detail === 'string') return rejectWithValue(detail);
      return rejectWithValue(error?.response?.data?.message ?? 'Failed to fetch jewellery subtypes');
    }
  }
);

const adminJewellerySubtypesSlice = createSlice({
  name: 'adminJewellerySubtypes',
  initialState,
  reducers: {
    resetJewellerySubtypes(state) {
      state.subtypes = [];
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminJewellerySubtypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminJewellerySubtypes.fulfilled, (state, action) => {
        state.loading = false;
        state.subtypes = action.payload;
      })
      .addCase(fetchAdminJewellerySubtypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetJewellerySubtypes } = adminJewellerySubtypesSlice.actions;
export default adminJewellerySubtypesSlice.reducer;
