import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface RefineDesignPayload {
  designId: string | number;
  prompt_used: string;
  model_used: string;
  base_design_image_url: string;
  style_tags: string;
  design_focus: string;
  parent_variant_id: number;
  files?: File[];
}

export interface RefineDesignResponse {
  id?: string | number;
  design_id?: string | number;
  variant_name?: string;
  [key: string]: unknown;
}

interface RefineDesignState {
  loading: boolean;
  error: string | null;
  data: RefineDesignResponse | null;
}

const initialState: RefineDesignState = {
  loading: false,
  error: null,
  data: null,
};

export const refineDesign = createAsyncThunk<
  RefineDesignResponse,
  RefineDesignPayload,
  { rejectValue: string }
>(
  'retailer/refineDesign',
  async ({ designId, ...payload }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('parent_variant_id', String(payload.parent_variant_id));
      formData.append('prompt_used', payload.prompt_used || '');
      formData.append('model_used', payload.model_used || '');
      formData.append('base_design_image_url', payload.base_design_image_url || '');
      formData.append('style_tags', payload.style_tags || '');
      formData.append('design_focus', payload.design_focus || '');

      if (payload.files && payload.files.length > 0) {
        payload.files.forEach((file) => {
          formData.append('files', file);
        });
      }

      console.info('[RefineDesign] API request', {
        url: `/api/v2/design-variant/${designId}/variants/refine`,
        parent_variant_id: payload.parent_variant_id,
        filesCount: payload.files?.length ?? 0,
      });

      const response = await axiosInstance.post(
        `/api/v2/design-variant/${designId}/variants/refine`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Accept: 'application/json',
          },
        }
      );
      console.info('[RefineDesign] API response', response.data);
      return response.data as RefineDesignResponse;
    } catch (error: any) {
      console.error('[RefineDesign] API error', error);
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to refine design.';
      return rejectWithValue(message);
    }
  }
);

const designVariantRefineSlice = createSlice({
  name: 'retailerDesignVariantRefine',
  initialState,
  reducers: {
    resetRefineDesign(state) {
      state.loading = false;
      state.error = null;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(refineDesign.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(refineDesign.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(refineDesign.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetRefineDesign } = designVariantRefineSlice.actions;
export default designVariantRefineSlice.reducer;
