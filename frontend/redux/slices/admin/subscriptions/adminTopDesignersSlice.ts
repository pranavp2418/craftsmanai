import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';

export interface TopDesignerUser {
  id: number;
  name: string;
  email: string;
}

export interface TopDesignerItem {
  user: TopDesignerUser;
  totalDesignsCreated: number;
  totalDesignShares: number;
  totalManufacturerQuotes: number;
}

export interface TopDesignersPagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TopDesignersResponse {
  items: TopDesignerItem[];
  pagination: TopDesignersPagination;
}

interface AdminTopDesignersState {
  data: TopDesignersResponse | null;
  loading: boolean;
  error: string | null;
}

const initialState: AdminTopDesignersState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchTopDesigners = createAsyncThunk<
  TopDesignersResponse,
  { page?: number; pageSize?: number } | void,
  { rejectValue: string }
>('adminTopDesigners/fetch', async (params, { rejectWithValue }) => {
  try {
    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 5;
    const response = await axiosInstance.get(
      `/api/v2/admin/subscription-plans/top-designers?page=${page}&page_size=${pageSize}`
    );
    return response.data;
  } catch (error: any) {
    return rejectWithValue(
      error?.response?.data?.detail ||
        error?.message ||
        'Failed to fetch top designers.'
    );
  }
});

const adminTopDesignersSlice = createSlice({
  name: 'adminTopDesigners',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTopDesigners.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTopDesigners.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchTopDesigners.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export default adminTopDesignersSlice.reducer;
