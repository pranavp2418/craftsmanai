import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface BrandSettings {
  brand_name?: string;
  logo_url?: string;
  logo?: string;
  brand_logo_url?: string;
  business_email?: string;
  phone_number?: string;
  primary_color?: string;
  can_use_logo?: boolean;
  can_use_brand_name?: boolean;
  can_use_custom_color?: boolean;
}

interface BrandState {
  settingsStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  settingsError: string | null;
  settingsItem: BrandSettings | null;
  updateStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  updateError: string | null;
}

const initialState: BrandState = {
  settingsStatus: 'idle',
  settingsError: null,
  settingsItem: null,
  updateStatus: 'idle',
  updateError: null,
};

export const fetchBrandSettings = createAsyncThunk<
  BrandSettings,
  void,
  { rejectValue: string }
>('retailer/settings/fetchBrandSettings', async (_, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.get('/api/v2/brand-settings/');
    return response.data ?? {};
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to load brand settings.';
    return rejectWithValue(message);
  }
});

export const updateBrandSettings = createAsyncThunk<
  BrandSettings,
  Partial<BrandSettings>,
  { rejectValue: string }
>('retailer/settings/updateBrandSettings', async (payload, { dispatch, rejectWithValue }) => {
  try {
    const response = await axiosInstance.put('/api/v2/brand-settings/', payload);
    const data = response.data ?? {};
    dispatch(fetchBrandSettings());
    return data;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to update brand settings.';
    return rejectWithValue(message);
  }
});

const brandSlice = createSlice({
  name: 'retailerBrand',
  initialState,
  reducers: {
    resetBrandSettings(state) {
      state.settingsStatus = 'idle';
      state.settingsError = null;
      state.settingsItem = null;
      state.updateStatus = 'idle';
      state.updateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBrandSettings.pending, (state) => {
        state.settingsStatus = 'loading';
        state.settingsError = null;
      })
      .addCase(fetchBrandSettings.fulfilled, (state, action) => {
        state.settingsStatus = 'succeeded';
        state.settingsItem = action.payload;
        state.settingsError = null;
      })
      .addCase(fetchBrandSettings.rejected, (state, action) => {
        state.settingsStatus = 'failed';
        state.settingsError = action.payload ?? 'Failed to load brand settings.';
      })
      .addCase(updateBrandSettings.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateBrandSettings.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.settingsItem = action.payload;
        state.updateError = null;
      })
      .addCase(updateBrandSettings.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload ?? 'Failed to update brand settings.';
      });
  },
});

export const { resetBrandSettings } = brandSlice.actions;
export default brandSlice.reducer;
