import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface QuizSubtype {
  label: string;
  value: string;
}

interface AdminQuizSubtypesState {
  subtypes: QuizSubtype[];
  loading: boolean;
  error: string | null;
}

const initialState: AdminQuizSubtypesState = {
  subtypes: [],
  loading: false,
  error: null,
};

export const fetchQuizSubtypes = createAsyncThunk(
  'adminQuizSubtypes/fetch',
  async (key: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/quiz/jewellery/subtypes`,
        { params: { type: key } }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = response.data?.data ?? response.data ?? [];
      const subtypes: QuizSubtype[] = raw.map((item) => ({
        label: item.label ?? item.name ?? '',
        value: item.label ?? item.value ?? '',
      }));
      return subtypes;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message ?? 'Failed to fetch jewellery subtypes');
    }
  }
);

const adminQuizSubtypesSlice = createSlice({
  name: 'adminQuizSubtypes',
  initialState,
  reducers: {
    clearSubtypes(state) {
      state.subtypes = [];
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuizSubtypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchQuizSubtypes.fulfilled, (state, action) => {
        state.loading = false;
        state.subtypes = action.payload;
      })
      .addCase(fetchQuizSubtypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearSubtypes } = adminQuizSubtypesSlice.actions;
export default adminQuizSubtypesSlice.reducer;
