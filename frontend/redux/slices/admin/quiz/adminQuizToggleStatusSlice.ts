import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

interface AdminQuizToggleStatusState {
  loading: boolean;
  error: string | null;
  successId: string | null;
}

const initialState: AdminQuizToggleStatusState = {
  loading: false,
  error: null,
  successId: null,
};

export const toggleQuizQuestionStatus = createAsyncThunk(
  'adminQuizToggleStatus/toggle',
  async ({ questionId, newStatus }: { questionId: string; newStatus: 'ACTIVE' | 'INACTIVE' }, { rejectWithValue }) => {
    try {
      await axiosInstance.patch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/quiz/question/${questionId}/status`,
        { status: newStatus }
      );
      return questionId;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to update question status'
      );
    }
  }
);

const adminQuizToggleStatusSlice = createSlice({
  name: 'adminQuizToggleStatus',
  initialState,
  reducers: {
    resetToggleStatus(state) {
      state.loading = false;
      state.error = null;
      state.successId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(toggleQuizQuestionStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.successId = null;
      })
      .addCase(toggleQuizQuestionStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.successId = action.payload;
      })
      .addCase(toggleQuizQuestionStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetToggleStatus } = adminQuizToggleStatusSlice.actions;
export default adminQuizToggleStatusSlice.reducer;
