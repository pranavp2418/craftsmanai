import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface CreateDesignPayload {
  name: string;
  jewellery_type: string;
  user_prompt?: string;
  files?: File[];
}

export interface CreateDesignResponse {
  id?: string | number;
  request_id?: string | number;
  design_code?: string | null;
  name?: string | null;
  data?: {
    id?: string | number;
    request_id?: string | number;
    design_code?: string | null;
    name?: string | null;
  };
  [key: string]: unknown;
}

interface CreateDesignState {
  loading: boolean;
  error: string | null;
  data: CreateDesignResponse | null;
}

const initialState: CreateDesignState = {
  loading: false,
  error: null,
  data: null,
};

export const createDesign = createAsyncThunk<
  CreateDesignResponse,
  CreateDesignPayload,
  { rejectValue: string }
>(
  'retailer/createDesign',
  async (payload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('name', payload.name || '');
      formData.append('jewellery_type', payload.jewellery_type);
      if (payload.user_prompt !== undefined) {
        formData.append('user_prompt', payload.user_prompt);
      }
      if (payload.files?.length) {
        payload.files.forEach((file) => {
          formData.append('files', file);
        });
      }

      const response = await axiosInstance.post('/api/v2/design/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/json',
        },
      });
      if (process.env.NODE_ENV !== 'production') {
        // Dev helper: inspect create design response
        // eslint-disable-next-line no-console
        console.debug('[createDesign] response:', response.data);
      }
      return response.data as CreateDesignResponse;
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to create design.';
      return rejectWithValue(message);
    }
  }
);

const createDesignSlice = createSlice({
  name: 'retailerCreateDesign',
  initialState,
  reducers: {
    resetCreateDesign(state) {
      state.loading = false;
      state.error = null;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(createDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetCreateDesign } = createDesignSlice.actions;
export default createDesignSlice.reducer;
