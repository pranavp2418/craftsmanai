import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export type AppearanceTheme = 'light' | 'dark' | 'system';

export interface AppearanceSettings {
  theme: AppearanceTheme;
  navigation_color: string;
}

interface AppearanceState {
  theme: AppearanceTheme;
  navigationColor: string;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  updateStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  previousTheme: AppearanceTheme | null;
  previousNavigationColor: string | null;
}

const DEFAULT_NAVIGATION_COLOR = '#3676E0';

const initialState: AppearanceState = {
  theme: 'light',
  navigationColor: DEFAULT_NAVIGATION_COLOR,
  status: 'idle',
  updateStatus: 'idle',
  error: null,
  previousTheme: null,
  previousNavigationColor: null,
};

function normalizeTheme(value: unknown): AppearanceTheme {
  const theme = String(value).toLowerCase();
  if (theme === 'dark' || theme === 'light' || theme === 'system') {
    return theme;
  }
  return 'system';
}

function persistTheme(theme: AppearanceTheme) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('appearance:theme', theme);
  } catch {
    // Ignore storage failures.
  }
}

function clearThemeCache() {
  // Theme settings are client-side/localStorage only and should persist across logout.
}

export const fetchRetailerAppearance = createAsyncThunk<
  AppearanceSettings,
  void,
  { rejectValue: string }
>('retailer/settings/fetchRetailerAppearance', async (_, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.get('/api/v2/user-profile/appearance');
    const data = response.data ?? {};

    const settings: AppearanceSettings = {
      theme: normalizeTheme(data.theme),
      navigation_color: data.navigation_color || DEFAULT_NAVIGATION_COLOR,
    };

    persistTheme(settings.theme);
    return settings;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to load appearance settings.';
    return rejectWithValue(message);
  }
});

export const updateRetailerAppearance = createAsyncThunk<
  AppearanceSettings,
  AppearanceSettings,
  { rejectValue: string }
>('retailer/settings/updateRetailerAppearance', async (payload, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.put('/api/v2/user-profile/appearance', payload);
    const data = response.data ?? {};

    const settings: AppearanceSettings = {
      theme: normalizeTheme(data.theme ?? payload.theme),
      navigation_color: data.navigation_color || payload.navigation_color || DEFAULT_NAVIGATION_COLOR,
    };

    persistTheme(settings.theme);
    return settings;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to update appearance settings.';
    return rejectWithValue(message);
  }
});

const appearanceSlice = createSlice({
  name: 'retailerAppearance',
  initialState,
  reducers: {
    resetAppearance: (state) => {
      state.theme = 'light';
      state.navigationColor = DEFAULT_NAVIGATION_COLOR;
      state.status = 'idle';
      state.updateStatus = 'idle';
      state.error = null;
      state.previousTheme = null;
      state.previousNavigationColor = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRetailerAppearance.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchRetailerAppearance.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.theme = action.payload.theme;
        state.navigationColor = action.payload.navigation_color;
        state.error = null;
        state.previousTheme = null;
        state.previousNavigationColor = null;
      })
      .addCase(fetchRetailerAppearance.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to load appearance settings.';
      })
      .addCase(updateRetailerAppearance.pending, (state) => {
        state.updateStatus = 'loading';
        state.error = null;
      })
      .addCase(updateRetailerAppearance.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.status = 'succeeded';
        state.theme = action.payload.theme;
        state.navigationColor = action.payload.navigation_color;
        state.error = null;
      })
      .addCase(updateRetailerAppearance.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.error = action.payload || 'Failed to update appearance settings.';
      });
  },
});

export const { resetAppearance } = appearanceSlice.actions;
export default appearanceSlice.reducer;
