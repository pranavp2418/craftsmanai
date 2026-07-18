import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import { toast } from 'react-toastify';

export interface ContactPayload {
  full_name: string;
  business_name: string;
  email: string;
  phone: string;
  store_type: string;
  interest: string;
}

interface ContactState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

const initialState: ContactState = {
  loading: false,
  error: null,
  success: false,
};

export const submitContactForm = createAsyncThunk<
  void,
  ContactPayload,
  { rejectValue: string }
>(
  'retailer/submitContactForm',
  async (payload, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/v2/public/contact', payload, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      const successMessage = response.data?.message || 'Your inquiry has been submitted successfully!';
      toast.success(successMessage);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg ?? String(d)).join(', ')
        : detail ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to submit contact form.';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

const contactSlice = createSlice({
  name: 'retailerContact',
  initialState,
  reducers: {
    resetContactState(state) {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitContactForm.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(submitContactForm.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(submitContactForm.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? 'Failed to submit request';
        state.success = false;
      });
  },
});

export const { resetContactState } = contactSlice.actions;
export default contactSlice.reducer;
