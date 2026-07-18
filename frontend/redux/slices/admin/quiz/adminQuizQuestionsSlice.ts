import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface QuizSuboption {
  name: string;
  image_url: string;
}

export interface QuizOption {
  id: string;
  label: string;
  image: string;
  suboptions?: QuizSuboption[];
}

export interface QuizQuestion {
  id: string;
  questionNumber: string;
  status: 'enabled' | 'disabled';
  type: 'Image - Based' | 'Text - Based';
  text: string;
  options: QuizOption[];
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
}

interface AdminQuizQuestionsState {
  questions: QuizQuestion[];
  pagination: Pagination;
  loading: boolean;
  error: string | null;
}

const initialState: AdminQuizQuestionsState = {
  questions: [],
  pagination: { total: 0, page: 1, limit: 10 },
  loading: false,
  error: null,
};

export interface FetchQuizQuestionsParams {
  jewellery_type: string;
  jewellery_subtype?: string;
  page?: number;
  limit?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOption(opt: any, idx: number): QuizOption {
  if (typeof opt === 'string') {
    return { id: `opt-${idx}`, label: opt, image: '' };
  }
  return {
    id: `opt-${idx}`,
    label: opt.name ?? opt.label ?? '',
    image: opt.image_url ?? opt.image ?? '',
    suboptions: Array.isArray(opt.suboptions) ? opt.suboptions.map((sub: any) => ({
      name: sub.name ?? sub.label ?? '',
      image_url: sub.image_url ?? sub.image ?? '',
    })) : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeQuestion(q: any, index: number): QuizQuestion {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawOptions: any[] = q.options ?? [];
  const isImageBased =
    rawOptions.length > 0 && typeof rawOptions[0] === 'object' && rawOptions[0] !== null;

  return {
    id: q.id ?? String(index),
    questionNumber: `Q${q.order ?? index + 1}`,
    status: q.is_active === false ? 'disabled' : 'enabled',
    type: isImageBased ? 'Image - Based' : 'Text - Based',
    text: q.question_text ?? q.text ?? '',
    options: rawOptions.map((opt, i) => normalizeOption(opt, i)),
  };
}

export const fetchQuizQuestions = createAsyncThunk(
  'adminQuizQuestions/fetch',
  async (params: FetchQuizQuestionsParams, { rejectWithValue }) => {
    try {
      const { jewellery_type, jewellery_subtype, page = 1, limit = 50 } = params;
      
      const queryParams = new URLSearchParams();
      queryParams.append('jewellery_type', jewellery_type);
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());
      if (jewellery_subtype) {
        queryParams.append('jewellery_subtype', jewellery_subtype);
      }

      const response = await axiosInstance.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/admin/quiz/get-questions?${queryParams.toString()}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = response.data;
      const raw = d?.data ?? d?.questions ?? d ?? [];
      return {
        questions: raw.map(normalizeQuestion),
        pagination: {
          total: d?.total ?? raw.length,
          page: d?.page ?? page,
          limit: d?.limit ?? limit,
        },
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message ?? 'Failed to fetch quiz questions');
    }
  }
);

const adminQuizQuestionsSlice = createSlice({
  name: 'adminQuizQuestions',
  initialState,
  reducers: {
    clearQuizQuestions(state) {
      state.questions = [];
      state.error = null;
    },
    toggleQuestionStatus(state, action: { payload: string }) {
      const q = state.questions.find((x) => x.id === action.payload);
      if (q) q.status = q.status === 'enabled' ? 'disabled' : 'enabled';
    },
    reorderQuestions(
      state,
      action: { payload: { questionId: string; direction: 'up' | 'down' } }
    ) {
      const { questionId, direction } = action.payload;
      const idx = state.questions.findIndex((q) => q.id === questionId);
      if (idx === -1) return;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= state.questions.length) return;
      [state.questions[idx], state.questions[swapIdx]] = [
        state.questions[swapIdx],
        state.questions[idx],
      ];
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateQuestion(state, action: { payload: any }) {
      const raw = action.payload;
      const idx = state.questions.findIndex((q) => q.id === raw.id);
      if (idx === -1) return;
      state.questions[idx] = normalizeQuestion(raw, idx);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuizQuestions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchQuizQuestions.fulfilled, (state, action) => {
        state.loading = false;
        state.questions = action.payload.questions;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchQuizQuestions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearQuizQuestions, toggleQuestionStatus, reorderQuestions, updateQuestion } =
  adminQuizQuestionsSlice.actions;
export default adminQuizQuestionsSlice.reducer;
