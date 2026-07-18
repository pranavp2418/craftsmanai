import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuestionKey {
  quiz_question_key: string;
  description: string | null;
}

export interface PaginationInfo {
  current_page: number;
  items_per_page: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface AdminQuestionKeysState {
  keys: QuestionKey[];
  pagination: PaginationInfo | null;
  search: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: AdminQuestionKeysState = {
  keys: [],
  pagination: null,
  search: null,
  loading: false,
  loadingMore: false,
  error: null,
};

// ─── Async Thunk ──────────────────────────────────────────────────────────────

interface FetchParams {
  search?: string;
  page?: number;
  limit?: number;
  append?: boolean;
}

export const fetchQuestionKeys = createAsyncThunk<
  { question_keys: QuestionKey[]; pagination: PaginationInfo; search: string | null },
  FetchParams | void,
  { rejectValue: string }
>(
  'adminQuestionKeys/fetch',
  async (params, { rejectWithValue }) => {
    try {
      const { search, page = 1, limit = 10 } = params || {};
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (page) queryParams.append('page', String(page));
      if (limit) queryParams.append('limit', String(limit));

      const response = await axiosInstance.get(`/api/v1/admin/quiz/production-sheet/question-keys?${queryParams.toString()}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(
        error?.response?.data?.detail || 
        error?.message || 
        'Failed to fetch question keys.'
      );
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const adminQuestionKeysSlice = createSlice({
  name: 'adminQuestionKeys',
  initialState,
  reducers: {
    resetKeys: (state) => {
      state.keys = [];
      state.pagination = null;
      state.search = null;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuestionKeys.pending, (state, action) => {
        const isAppend = (action.meta.arg as FetchParams)?.append;
        if (isAppend) {
          state.loadingMore = true;
        } else {
          state.loading = true;
        }
        state.error = null;
      })
      .addCase(fetchQuestionKeys.fulfilled, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        const isAppend = (action.meta.arg as FetchParams)?.append;
        
        if (isAppend) {
          state.keys = [...state.keys, ...(action.payload.question_keys || [])];
        } else {
          state.keys = action.payload.question_keys || [];
        }
        
        state.pagination = action.payload.pagination;
        state.search = action.payload.search;
      })
      .addCase(fetchQuestionKeys.rejected, (state, action) => {
        state.loading = false;
        state.loadingMore = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetKeys } = adminQuestionKeysSlice.actions;
export default adminQuestionKeysSlice.reducer;
