import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface TopUpPack {
  id: string;
  renders: number;
  price: number;
  is_active: boolean;
}

interface UpdateTopUpPackPayload {
  id: string;
  renders: number;
  price: number;
  is_active: boolean;
}

interface AdminTopUpPacksState {
  packs: TopUpPack[];
  loading: boolean;
  error: string | null;
  updating: boolean;
  updateError: string | null;
}

const initialState: AdminTopUpPacksState = {
  packs: [],
  loading: false,
  error: null,
  updating: false,
  updateError: null,
};

const normalizePack = (pack: Partial<TopUpPack> & Record<string, any>): TopUpPack => ({
  id: String(pack.id),
  renders: Number(pack.renders ?? 0),
  price: Number(pack.price ?? 0),
  is_active: Boolean(pack.is_active),
});

export const fetchTopUpPacks = createAsyncThunk<
  TopUpPack[],
  { onlyActive?: boolean } | void,
  { rejectValue: string }
>('adminTopUpPacks/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const onlyActive = params && typeof params === 'object' ? Boolean(params.onlyActive) : false;
    const response = await axiosInstance.get('/api/v2/admin/subscription-plans/topup-packs', {
      params: {
        only_active: onlyActive,
      },
    });

    const data = response.data;
    const packs = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.items)
          ? data.items
          : [];

    return packs.map(normalizePack);
  } catch (error) {
    return rejectWithValue(formatApiError(error));
  }
});

export const updateTopUpPack = createAsyncThunk<
  TopUpPack,
  UpdateTopUpPackPayload,
  { rejectValue: string }
>('adminTopUpPacks/update', async ({ id, renders, price, is_active }, { rejectWithValue }) => {
  try {
    await axiosInstance.put('/api/v2/admin/subscription-plans/topup-packs', undefined, {
      params: {
        id,
        renders,
        price,
        is_active,
      },
    });

    return {
      id,
      renders,
      price,
      is_active,
    };
  } catch (error) {
    return rejectWithValue(formatApiError(error));
  }
});

const adminTopUpPacksSlice = createSlice({
  name: 'adminTopUpPacks',
  initialState,
  reducers: {
    resetTopUpPackState(state) {
      state.loading = false;
      state.error = null;
      state.updating = false;
      state.updateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTopUpPacks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTopUpPacks.fulfilled, (state, action) => {
        state.loading = false;
        state.packs = action.payload;
      })
      .addCase(fetchTopUpPacks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to fetch top-up packs.';
      })
      .addCase(updateTopUpPack.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateTopUpPack.fulfilled, (state, action) => {
        state.updating = false;
        const index = state.packs.findIndex((pack) => pack.id === action.payload.id);
        const existing = index >= 0 ? state.packs[index] : undefined;
        const nextPack = normalizePack({
          ...(existing ?? {}),
          ...action.payload,
        });

        if (index >= 0) {
          state.packs[index] = nextPack;
        } else {
          state.packs.unshift(nextPack);
        }
      })
      .addCase(updateTopUpPack.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload ?? 'Failed to update top-up pack.';
      });
  },
});

export const { resetTopUpPackState } = adminTopUpPacksSlice.actions;
export default adminTopUpPacksSlice.reducer;
