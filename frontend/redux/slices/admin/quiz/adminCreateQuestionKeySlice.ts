import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateQuestionKeyPayload {
  question_key: string;
  category: string;
  subsection: string;
  description: string;
  is_active: boolean;
}

interface AdminCreateQuestionKeyState {
  loading: boolean;
  success: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminCreateQuestionKeyState = {
  loading: false,
  success: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

export const createQuestionKey = createAsyncThunk<
  void,
  CreateQuestionKeyPayload,
  { rejectValue: string }
>(
  'adminCreateQuestionKey/create',
  async (payload, { rejectWithValue }) => {
    try {
      await axiosInstance.post('/api/v1/admin/quiz/production-sheet/question-keys', payload);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to create question key.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminCreateQuestionKeySlice = createSlice({
  name: 'adminCreateQuestionKey',
  initialState,
  reducers: {
    resetCreateKey: (state) => {
      state.loading = false;
      state.success = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createQuestionKey.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createQuestionKey.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(createQuestionKey.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetCreateKey } = adminCreateQuestionKeySlice.actions;
export default adminCreateQuestionKeySlice.reducer;
