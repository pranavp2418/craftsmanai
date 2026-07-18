import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import type { AngleView } from '@/lib/requestsData';

export interface FetchVariantAnglesParams {
  variantId: string | number;
  metals?: string[];
}

interface FetchVariantAnglesResult {
  variantId: string | number;
  angles: AngleView[];
  metals: string[];
  raw: unknown;
}

interface VariantAnglesState {
  byVariantId: Record<string, Record<string, AngleView[]>>;
  loading: boolean;
  error: string | null;
}

const initialState: VariantAnglesState = {
  byVariantId: {},
  loading: false,
  error: null,
};

const toAngleView = (item: any, index: number): AngleView => {
  const id = String(item?.id ?? item?.angle_id ?? item?.angle ?? `angle-${index}`);
  const label =
    item?.label ??
    item?.angle_label ??
    item?.name ??
    item?.view ??
    `View ${index + 1}`;
  const image = item?.image ?? item?.image_url ?? item?.url ?? item?.file_url ?? '';
  return { id, label, image };
};

const normalizeAnglesResponse = (data: any): AngleView[] => {
  if (!data) return [];
  const list =
    (Array.isArray(data) && data) ||
    (Array.isArray(data?.angles) && data.angles) ||
    (Array.isArray(data?.items) && data.items) ||
    (Array.isArray(data?.results) && data.results) ||
    [];
  return list.map((item, index) => toAngleView(item, index)).filter((a) => a.image);
};

export const fetchVariantAngles = createAsyncThunk<
  FetchVariantAnglesResult,
  FetchVariantAnglesParams,
  { rejectValue: string }
>(
  'retailer/designVariantAngles/fetch',
  async ({ variantId, metals = ['gold'] }, { rejectWithValue }) => {
    try {
      const payload = { metals };
      const response = await axiosInstance.post(`/api/v2/design-variant/variants/${variantId}/angles`, payload);
      const angles = normalizeAnglesResponse(response.data);
      return { variantId, angles, metals, raw: response.data };
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to fetch variant angles.';
      return rejectWithValue(message);
    }
  }
);

const designVariantAnglesSlice = createSlice({
  name: 'retailerDesignVariantAngles',
  initialState,
  reducers: {
    resetVariantAngles(state) {
      state.byVariantId = {};
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVariantAngles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVariantAngles.fulfilled, (state, action) => {
        state.loading = false;
        const variantId = String(action.payload.variantId);
        const metal = action.payload.metals?.[0] || 'gold';
        if (!state.byVariantId[variantId]) {
          state.byVariantId[variantId] = {};
        }
        state.byVariantId[variantId][metal] = action.payload.angles;
      })
      .addCase(fetchVariantAngles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      });
  },
});

export const { resetVariantAngles } = designVariantAnglesSlice.actions;
export default designVariantAnglesSlice.reducer;
