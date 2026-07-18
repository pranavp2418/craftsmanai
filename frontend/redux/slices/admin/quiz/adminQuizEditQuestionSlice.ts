import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

interface EditQuestionSuboption {
  name: string;
  image_url: string;
}

interface EditQuestionPayload {
  questionId: string;
  jewellery_type: string;
  jewellery_subtype?: string;
  question_text: string;
  question_type: 'single_select' | 'multiple_select' | 'text' | 'file_upload' | 'range' | 'custom_text';
  options: { name: string; image_url: string; suboptions?: EditQuestionSuboption[] }[];
  min_selections: number;
  max_selections: number;
  order: number;
  is_active: boolean;
}

interface AdminQuizEditQuestionState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AdminQuizEditQuestionState = {
  loading: false,
  error: null,
  success: false,
};

export const editQuizQuestion = createAsyncThunk(
  'adminQuizEditQuestion/edit',
  async (
    { questionId, jewellery_type, jewellery_subtype, question_text, question_type, options, min_selections, max_selections, order, is_active }: EditQuestionPayload,
    { rejectWithValue }
  ) => {
    try {
      const response = await axiosInstance.patch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/quiz/question/${questionId}`,
        { jewellery_type, jewellery_subtype, question_text, question_type, options, min_selections, max_selections, order, is_active }
      );
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(
        err.response?.data?.message ?? 'Failed to update question'
      );
    }
  }
);

const adminQuizEditQuestionSlice = createSlice({
  name: 'adminQuizEditQuestion',
  initialState,
  reducers: {
    resetEditQuestion(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(editQuizQuestion.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(editQuizQuestion.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(editQuizQuestion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetEditQuestion } = adminQuizEditQuestionSlice.actions;
export default adminQuizEditQuestionSlice.reducer;
