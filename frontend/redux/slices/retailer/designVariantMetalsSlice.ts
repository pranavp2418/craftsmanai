import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import { AngleView } from '@/lib/requestsData';
import { fetchVariantsByDesignId } from './designVariantSlice';

export interface GenerateVariantMetalsParams {
  variantId: string | number;
  metals: string[];
}

export interface MetalGeneratedData {
  variantId: string | number;
  metal: string;
  data: {
    mainImage?: string;
    angles?: AngleView[];
    raw?: any;
  };
}

interface GenerateVariantMetalsResult {
  variantId: string | number;
  raw: any;
}

interface VariantMetalsState {
  byVariantId: Record<string, Record<string, { mainImage?: string; angles?: AngleView[] }>>;
  loading: boolean;
  error: string | null;
}

const initialState: VariantMetalsState = {
  byVariantId: {},
  loading: false,
  error: null,
};

export const generateVariantMetals = createAsyncThunk<
  GenerateVariantMetalsResult,
  GenerateVariantMetalsParams,
  { rejectValue: string }
>(
  'retailer/designVariantMetals/generate',
  async ({ variantId, metals }, { rejectWithValue }) => {
    try {
      const payload = { metals };
      const response = await axiosInstance.post(`/api/v2/design-variant/variants/${variantId}/metals`, payload);
      return { variantId, raw: response.data };
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to generate variant metals.';
      return rejectWithValue(message);
    }
  }
);

const designVariantMetalsSlice = createSlice({
  name: 'retailerDesignVariantMetals',
  initialState,
  reducers: {
    resetVariantMetals(state) {
      state.loading = false;
      state.error = null;
    },
    setMetalGeneratedData(state, action: PayloadAction<MetalGeneratedData>) {
      const { variantId, metal, data } = action.payload;
      const vId = String(variantId);
      if (!state.byVariantId[vId]) {
        state.byVariantId[vId] = {};
      }
      state.byVariantId[vId][metal] = {
        mainImage: data.mainImage || state.byVariantId[vId][metal]?.mainImage,
        angles: data.angles || state.byVariantId[vId][metal]?.angles,
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateVariantMetals.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateVariantMetals.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(generateVariantMetals.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Unknown error';
      })
      .addCase(fetchVariantsByDesignId.fulfilled, (state, action) => {
        const variants = action.payload ?? [];
        for (const variant of variants) {
          const vId = String(variant.id);
          if (!vId) continue;

          let parsedMetals: any = null;
          try {
            if (variant.metal_variations_json) {
              if (typeof variant.metal_variations_json === 'string') {
                parsedMetals = JSON.parse(variant.metal_variations_json);
              } else {
                parsedMetals = variant.metal_variations_json;
              }
            }
          } catch (e) {
            console.error('Error parsing metal_variations_json in metals slice:', e);
          }

          if (parsedMetals && typeof parsedMetals === 'object') {
            if (!state.byVariantId[vId]) {
              state.byVariantId[vId] = {};
            }

            for (const [metalKey, metalValue] of Object.entries(parsedMetals)) {
              if (!metalValue) continue;

              const mainImage = typeof metalValue === 'string'
                ? metalValue
                : ((metalValue as any).mainImage || (metalValue as any).url || (metalValue as any).image_url);

              const angleData = (metalValue as any).angles || (metalValue as any).generated_angles;
              const angles = Array.isArray(angleData) ? angleData.map((item: any, i: number) => ({
                id: String(item?.id ?? `angle-${i}`),
                label: item?.label ?? `View ${i + 1}`,
                image: item?.image ?? item?.url ?? ''
              })).filter((a: any) => a.image) : undefined;

              if (mainImage) {
                state.byVariantId[vId][metalKey] = {
                  mainImage: mainImage || state.byVariantId[vId][metalKey]?.mainImage,
                  angles: angles || state.byVariantId[vId][metalKey]?.angles,
                };
              }
            }
          }
        }
      });
  },
});

export const { resetVariantMetals, setMetalGeneratedData } = designVariantMetalsSlice.actions;
export default designVariantMetalsSlice.reducer;