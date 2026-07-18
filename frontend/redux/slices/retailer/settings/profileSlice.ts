import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface UserProfile {
  id: number;
  email: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  whatsapp_number?: string;
  business_name?: string;
  profile_picture_url?: string;
  is_active?: boolean;
  is_verified?: boolean;
  is_superuser?: boolean;
  role?: string;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  whatsapp_number?: string;
  username?: string;
  business_name?: string;
}

interface ProfileState {
  profileStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  profileError: string | null;
  profileItem: UserProfile | null;
  updateStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  updateError: string | null;
}

const initialState: ProfileState = {
  profileStatus: 'idle',
  profileError: null,
  profileItem: null,
  updateStatus: 'idle',
  updateError: null,
};

export const fetchUserProfile = createAsyncThunk<UserProfile, void, { rejectValue: string }>(
  'retailer/profile/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/api/v2/user-profile/');
      return response.data as UserProfile;
    } catch (error: any) {
      const message = formatApiError(error) || 'Failed to load profile.';
      return rejectWithValue(message);
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState() as any;
      const { profileStatus } = state.retailerProfile;
      if (profileStatus === 'loading') {
        return false;
      }
    },
  }
);

export const updateUserProfile = createAsyncThunk<
  UserProfile,
  UpdateProfilePayload,
  { rejectValue: string }
>('retailer/profile/update', async (payload, { rejectWithValue }) => {
  try {
    const response = await axiosInstance.put('/api/v2/user-profile/', payload);
    return response.data as UserProfile;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to update profile.';
    return rejectWithValue(message);
  }
});

export const updateProfilePicture = createAsyncThunk<
  UserProfile,
  File,
  { rejectValue: string }
>('retailer/profile/updatePicture', async (file, { rejectWithValue }) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post('/api/v2/user-profile/profile-picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data as UserProfile;
  } catch (error: any) {
    const message = formatApiError(error) || 'Failed to update profile picture.';
    return rejectWithValue(message);
  }
});

const profileSlice = createSlice({
  name: 'retailerProfile',
  initialState,
  reducers: {
    resetProfile: (state) => {
      state.profileStatus = 'idle';
      state.profileError = null;
      state.profileItem = null;
      state.updateStatus = 'idle';
      state.updateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.profileStatus = 'loading';
        state.profileError = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.profileStatus = 'succeeded';
        state.profileItem = action.payload;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.profileStatus = 'failed';
        state.profileError = action.payload || 'Failed to load profile.';
      })
      .addCase(updateUserProfile.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.profileItem = action.payload;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || 'Failed to update profile.';
      })
      .addCase(updateProfilePicture.pending, (state) => {
        state.updateStatus = 'loading';
        state.updateError = null;
      })
      .addCase(updateProfilePicture.fulfilled, (state, action) => {
        state.updateStatus = 'succeeded';
        state.profileItem = action.payload;
      })
      .addCase(updateProfilePicture.rejected, (state, action) => {
        state.updateStatus = 'failed';
        state.updateError = action.payload || 'Failed to update profile picture.';
      });
  },
});

export const { resetProfile } = profileSlice.actions;
export default profileSlice.reducer;
