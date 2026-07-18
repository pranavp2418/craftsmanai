import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface SessionData {
  id: number;
  user_id: number;
  created_at: string;
  expires_at: string;
  is_revoked: boolean;
}

interface SessionsState {
  sessions: SessionData[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: SessionsState = {
  sessions: [],
  status: 'idle',
  error: null,
};

export const fetchSessions = createAsyncThunk<
  SessionData[],
  void,
  { rejectValue: string }
>('retailer/settings/fetchSessions', async (_, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.get('/api/v2/user-profile/sessions');
    return response.data;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to fetch sessions.';
    return rejectWithValue(message);
  }
},
{
  condition: (_, { getState }) => {
    const state = getState() as any;
    const { status } = state.retailerSessions;
    if (status === 'loading') {
      return false;
    }
  },
});

const sessionsSlice = createSlice({
  name: 'retailerSessions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSessions.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.sessions = action.payload || [];
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload || 'Failed to fetch sessions.';
      });
  },
});

export default sessionsSlice.reducer;
