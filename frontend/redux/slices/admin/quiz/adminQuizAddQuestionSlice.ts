import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface AddQuestionSuboption {
  name: string;
  image_url: string;
}

export interface AddQuestionOption {
  name: string;
  image_url: string;
  suboptions?: AddQuestionSuboption[];
}

export interface AddQuestionPayload {
  jewellery_type: string;
  jewellery_subtype: string;
  question_key: string;
  question_text: string;
  question_type: 'single_select' | 'multiple_select' | 'text' | 'file_upload' | 'range' | 'custom_text';
  options: AddQuestionOption[];
  min_selections: number;
  max_selections: number;
  order: number;
  is_active: boolean;
}

interface AdminQuizAddQuestionState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: AdminQuizAddQuestionState = {
  loading: false,
  error: null,
  success: false,
};

export const addQuizQuestion = createAsyncThunk(
  'adminQuizAddQuestion/add',
  async (payload: AddQuestionPayload, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/v1/admin/quiz/add-question', payload);
      return response.data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | { msg: string }[] } } };
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) {
        return rejectWithValue(detail.map((d) => d.msg).join(', '));
      }
      return rejectWithValue(typeof detail === 'string' ? detail : 'Failed to add question');
    }
  }
);

const adminQuizAddQuestionSlice = createSlice({
  name: 'adminQuizAddQuestion',
  initialState,
  reducers: {
    resetAddQuestion(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addQuizQuestion.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(addQuizQuestion.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(addQuizQuestion.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetAddQuestion } = adminQuizAddQuestionSlice.actions;
export default adminQuizAddQuestionSlice.reducer;
