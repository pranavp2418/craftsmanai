import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface QuizType {
  label: string;
  value: string;
}

interface AdminQuizTypesState {
  types: QuizType[];
  loading: boolean;
  error: string | null;
}

const initialState: AdminQuizTypesState = {
  types: [],
  loading: false,
  error: null,
};

export const fetchQuizTypes = createAsyncThunk(
  'adminQuizTypes/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/quiz/types`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = response.data?.data ?? response.data ?? [];
      return raw.map((item) => ({
        label: item.label ?? item.name ?? '',
        value: item.id ?? item.value ?? '',
      }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message ?? 'Failed to fetch jewelery types');
    }
  }
);

const adminQuizTypesSlice = createSlice({
  name: 'adminQuizTypes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuizTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchQuizTypes.fulfilled, (state, action) => {
        state.loading = false;
        state.types = action.payload;
      })
      .addCase(fetchQuizTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default adminQuizTypesSlice.reducer;
