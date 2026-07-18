import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axiosInstance from '../../src/utils/axios';

// Define the shape of the slice state
interface ExampleState {
  loading: boolean;
  error: string | null;
  success: boolean;
  data: any | null;
}

const initialState: ExampleState = {
  loading: false,
  error: null,
  success: false,
  data: null,
};

// Async thunk for making an API request
export const createExampleData = createAsyncThunk(
  'example/createData',
  async (payload: any, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/example', payload);
      return response.data;
    } catch (err: any) {
      // Safely extract backend error messages
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        'An unexpected error occurred';
        
      return rejectWithValue(errorMessage);
    }
  }
);

export const exampleSlice = createSlice({
  name: 'example',
  initialState,
  reducers: {
    resetExampleState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
      state.data = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createExampleData.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createExampleData.fulfilled, (state, action: PayloadAction<any>) => {
        state.loading = false;
        state.success = true;
        state.data = action.payload;
        state.error = null;
      })
      .addCase(createExampleData.rejected, (state, action) => {
        state.loading = false;
        state.success = false;
        state.error = (action.payload as string) || 'Failed to create data';
      });
  },
});

export const { resetExampleState } = exampleSlice.actions;

export default exampleSlice.reducer;
