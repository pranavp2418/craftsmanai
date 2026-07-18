import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { toast } from 'react-toastify';
import axiosInstance from '@/src/utils/hooks/axios';

export interface DownloadRenderPayload {
  variant_id: string | number;
  metal_variation_names?: string[];
  angle?: string;
}

interface DownloadRenderState {
  loading: boolean;
  error: string | null;
}

const initialState: DownloadRenderState = {
  loading: false,
  error: null,
};

const getFilenameFromHeaders = (contentDisposition?: string | null) => {
  if (!contentDisposition) return null;
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^;\"]+)"?/i.exec(contentDisposition);
  const raw = match?.[1] || match?.[2];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const guessExtension = (contentType?: string | null) => {
  if (!contentType) return 'jpg';
  const normalized = contentType.toLowerCase();
  if (normalized.includes('zip')) return 'zip';
  if (normalized.includes('pdf')) return 'pdf';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  return 'bin';
};

export const downloadDesignRender = createAsyncThunk<
  void,
  DownloadRenderPayload,
  { rejectValue: string }
>(
  'retailer/designDownloadRender/download',
  async ({ variant_id, metal_variation_names, angle }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        `/api/v2/design/download-render/${variant_id}`,
        {
          metal_variation_names: metal_variation_names || [],
          angle: angle || null,
        },
        {
          responseType: 'blob',
          headers: {
            'Content-Type': 'application/json',
            Accept: '*/*',
          },
        }
      );

      const contentDisposition = response.headers?.['content-disposition'] as string | undefined;
      const contentType = response.headers?.['content-type'] as string | undefined;
      const extension = guessExtension(contentType);
      const fallbackName = `render_${variant_id}.${extension}`;
      const filename = getFilenameFromHeaders(contentDisposition) || fallbackName;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to download render.';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

const designDownloadRenderSlice = createSlice({
  name: 'retailerDesignDownloadRender',
  initialState,
  reducers: {
    resetDownloadRenderState(state) {
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(downloadDesignRender.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(downloadDesignRender.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(downloadDesignRender.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetDownloadRenderState } = designDownloadRenderSlice.actions;
export default designDownloadRenderSlice.reducer;
