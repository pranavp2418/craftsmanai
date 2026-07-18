import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';

export interface CreateProductionSheetPayload {
  variant_id: number;
  manufacturing_image?: File | null;
  budget_range?: string;
  metal_details?: {
    type: string;
    karat: string;
    color: string;
    metal_weight?: string;
    weight?: string;
    hallmark_required?: string;
    rhodium_finish?: string;
  } | null;
  stone_type?: string;
  setting_type?: string;
  stone_count?: number;
  stone_size?: string;
  stone_size_unit?: string;
  stone_shape?: string;
  stone_color?: string;
  stone_clarity?: string;
  stone_certificate?: string;
  dimension?: {
    length?: string;
    width?: string;
    height?: string;
    ring_size?: string;
    notes?: string;
    chain_length?: string;
    bracelet_length?: string;
    bangle_size?: string;
    pendant_bail_width?: string;
  } | null;
  manufacturing_notes?: string;
}

export interface ProductionSheetResponse {
  // Define response fields based on your API here if known, else keeping generic
  [key: string]: any;
}

interface ProductionSheetState {
  loading: boolean;
  error: string | null;
  data: ProductionSheetResponse | null;
  draftSaving: boolean;
  draftError: string | null;
  lastQueriedVariantId: number | null;
  lastFetchedTimestamp: number;
}

const initialState: ProductionSheetState = {
  loading: false,
  error: null,
  data: null,
  draftSaving: false,
  draftError: null,
  lastQueriedVariantId: null,
  lastFetchedTimestamp: 0,
};

export const createProductionSheet = createAsyncThunk(
  'productionSheet/create',
  async (payload: CreateProductionSheetPayload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      
      const payloadData: Record<string, any> = {};
      
      if (payload.budget_range) payloadData.budget_range = payload.budget_range;
      
      if (payload.metal_details && (
        payload.metal_details.type ||
        payload.metal_details.karat ||
        payload.metal_details.color ||
        payload.metal_details.metal_weight ||
        payload.metal_details.weight ||
        payload.metal_details.hallmark_required ||
        payload.metal_details.rhodium_finish
      )) {
        payloadData.metal_details = payload.metal_details;
      }
      
      if (payload.stone_type) payloadData.stone_type = payload.stone_type;
      if (payload.setting_type) payloadData.setting_type = payload.setting_type;
      
      if (payload.stone_count !== undefined && payload.stone_count !== null) {
        payloadData.stone_count = Number(payload.stone_count);
      }
      
      if (payload.stone_size) payloadData.stone_size = payload.stone_size;
      if (payload.stone_size_unit) payloadData.stone_size_unit = payload.stone_size_unit;
      if (payload.stone_shape) payloadData.stone_shape = payload.stone_shape;
      if (payload.stone_color) payloadData.stone_color = payload.stone_color;
      if (payload.stone_clarity) payloadData.stone_clarity = payload.stone_clarity;
      if (payload.stone_certificate) payloadData.stone_certificate = payload.stone_certificate;
      
      if (payload.dimension && Object.keys(payload.dimension).length > 0) {
        payloadData.dimension = payload.dimension;
      }
      
      if (payload.manufacturing_notes) payloadData.manufacturing_notes = payload.manufacturing_notes;

      // Append 'payload_json' as stringified JSON blob
      formData.append('payload_json', JSON.stringify(payloadData));
      
      // Append 'manufacturing_image' as file if present
      if (payload.manufacturing_image) {
        formData.append('manufacturing_image', payload.manufacturing_image);
      }

      const response = await axiosInstance.post(
        `/api/v2/production-sheet/?variant_id=${payload.variant_id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.data) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue(error.message || 'Failed to create production sheet');
    }
  }
);

export const saveProductionSheetDraft = createAsyncThunk(
  'productionSheet/saveDraft',
  async (payload: CreateProductionSheetPayload, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      
      const payloadData: Record<string, any> = {};
      
      if (payload.budget_range) payloadData.budget_range = payload.budget_range;
      
      if (payload.metal_details && (
        payload.metal_details.type ||
        payload.metal_details.karat ||
        payload.metal_details.color ||
        payload.metal_details.metal_weight ||
        payload.metal_details.weight ||
        payload.metal_details.hallmark_required ||
        payload.metal_details.rhodium_finish
      )) {
        payloadData.metal_details = payload.metal_details;
      }
      
      if (payload.stone_type) payloadData.stone_type = payload.stone_type;
      if (payload.setting_type) payloadData.setting_type = payload.setting_type;
      
      if (payload.stone_count !== undefined && payload.stone_count !== null) {
        payloadData.stone_count = Number(payload.stone_count);
      }
      
      if (payload.stone_size) payloadData.stone_size = payload.stone_size;
      if (payload.stone_size_unit) payloadData.stone_size_unit = payload.stone_size_unit;
      if (payload.stone_shape) payloadData.stone_shape = payload.stone_shape;
      if (payload.stone_color) payloadData.stone_color = payload.stone_color;
      if (payload.stone_clarity) payloadData.stone_clarity = payload.stone_clarity;
      if (payload.stone_certificate) payloadData.stone_certificate = payload.stone_certificate;
      
      if (payload.dimension && Object.keys(payload.dimension).length > 0) {
        payloadData.dimension = payload.dimension;
      }
      
      if (payload.manufacturing_notes) payloadData.manufacturing_notes = payload.manufacturing_notes;

      // Append 'payload_json' as stringified JSON blob
      formData.append('payload_json', JSON.stringify(payloadData));
      
      // Append 'manufacturing_image' as file if present
      if (payload.manufacturing_image) {
        formData.append('manufacturing_image', payload.manufacturing_image);
      }

      const response = await axiosInstance.post(
        `/api/v2/production-sheet/draft/?variant_id=${payload.variant_id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.data) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue(error.message || 'Failed to save production sheet draft');
    }
  }
);

export const getProductionSheet = createAsyncThunk<
  ProductionSheetResponse,
  number | { variantId: number; forceRefresh?: boolean },
  { rejectValue: string }
>(
  'productionSheet/get',
  async (arg, { rejectWithValue }) => {
    const variantId = typeof arg === 'number' ? arg : arg.variantId;
    try {
      const response = await axiosInstance.get(`/api/v2/production-sheet/?variant_id=${variantId}`);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.data) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue(error.message || 'Failed to fetch production sheet');
    }
  },
  {
    condition: (arg, { getState }) => {
      const variantId = typeof arg === 'number' ? arg : arg.variantId;
      const forceRefresh = typeof arg === 'number' ? false : arg.forceRefresh;
      if (forceRefresh) return true;

      const state = getState() as any;
      const sheetState = state.productionSheet;
      if (sheetState) {
        if (sheetState.loading) {
          console.info('[GetProductionSheet] Aborted fetch: already loading');
          return false;
        }
        const timeDiff = Date.now() - (sheetState.lastFetchedTimestamp || 0);
        if (timeDiff < 1000 && sheetState.lastQueriedVariantId === Number(variantId)) {
          console.info('[GetProductionSheet] Aborted fetch: double-mount protection for variantId', variantId);
          return false;
        }
      }
    }
  }
);

const productionSheetSlice = createSlice({
  name: 'productionSheet',
  initialState,
  reducers: {
    resetProductionSheetState: (state) => {
      state.loading = false;
      state.error = null;
      state.data = null;
      state.draftSaving = false;
      state.draftError = null;
      state.lastQueriedVariantId = null;
      state.lastFetchedTimestamp = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createProductionSheet.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProductionSheet.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(createProductionSheet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(saveProductionSheetDraft.pending, (state) => {
        state.draftSaving = true;
        state.draftError = null;
      })
      .addCase(saveProductionSheetDraft.fulfilled, (state) => {
        state.draftSaving = false;
      })
      .addCase(saveProductionSheetDraft.rejected, (state, action) => {
        state.draftSaving = false;
        state.draftError = action.payload as string;
      })
      .addCase(getProductionSheet.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        const arg = action.meta.arg;
        const variantId = typeof arg === 'number' ? arg : arg.variantId;
        state.lastQueriedVariantId = variantId;
        state.lastFetchedTimestamp = Date.now();
      })
      .addCase(getProductionSheet.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload; // Update data with fetched production sheet
        const arg = action.meta.arg;
        const variantId = typeof arg === 'number' ? arg : arg.variantId;
        state.lastQueriedVariantId = variantId;
      })
      .addCase(getProductionSheet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        const arg = action.meta.arg;
        const variantId = typeof arg === 'number' ? arg : arg.variantId;
        state.lastQueriedVariantId = variantId;
      });
  },
});

export const { resetProductionSheetState } = productionSheetSlice.actions;

export default productionSheetSlice.reducer;