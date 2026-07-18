import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface ManufacturerEmailPayload {
	label: string;
	email: string;
}

export interface CreateManufacturerPayload {
	name: string;
	speciality: string;
	emails: ManufacturerEmailPayload[];
	phone_number: string;
	location: string;
	is_active?: boolean;
}

export interface UpdateManufacturerPayload {
	name: string;
	speciality: string;
	emails: ManufacturerEmailPayload[];
	phone_number: string;
	location: string;
	is_active: boolean;
}

export interface ManufacturerStatsResponse {
	total_requests?: number;
	completed_requests?: number;
	total_profit?: number;
	pending_requests?: number;
	avg_response_time?: string;
	last_activity?: string;
}

export interface ManufacturerApiResponse {
	id: number;
	created_by_user_id: number;
	name: string;
	speciality?: string;
	emails: ManufacturerEmailPayload[];
	phone_number: string;
	location: string;
	status: string;
	public_token: string;
	created_at: string;
	updated_at: string;
	stats?: ManufacturerStatsResponse;
	sent_requests?: unknown[];
	production_timeline?: unknown[];
}

export interface ManufacturerListResponse {
	items: ManufacturerApiResponse[];
	total: number;
}

export interface ListManufacturersParams {
	skip?: number;
	limit?: number;
	search?: string;
	status?: string;
	append?: boolean;
	forceRefresh?: boolean;
}

interface ManufacturerState {
	createStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	createError: string | null;
	lastCreated: ManufacturerApiResponse | null;
	listStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	listError: string | null;
	items: ManufacturerApiResponse[];
	total: number;
	detailStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	detailError: string | null;
	detailItem: ManufacturerApiResponse | null;
	updateStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	updateError: string | null;
	lastUpdated: ManufacturerApiResponse | null;
	deleteStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	deleteError: string | null;
	lastDeletedId: number | null;
	lastFetchedTimestamp: number;
}

const initialState: ManufacturerState = {
	createStatus: 'idle',
	createError: null,
	lastCreated: null,
	listStatus: 'idle',
	listError: null,
	items: [],
	total: 0,
	detailStatus: 'idle',
	detailError: null,
	detailItem: null,
	updateStatus: 'idle',
	updateError: null,
	lastUpdated: null,
	deleteStatus: 'idle',
	deleteError: null,
	lastDeletedId: null,
	lastFetchedTimestamp: 0,
};

export const createManufacturer = createAsyncThunk<
	ManufacturerApiResponse,
	CreateManufacturerPayload,
	{ rejectValue: string }
>('retailer/manufacturer/create', async (payload, { rejectWithValue }) => {
	try {
		const response = await axiosInstance.post('/api/v2/manufacturer/', payload);
		return response.data as ManufacturerApiResponse;
	} catch (error: any) {
		const message = formatApiError(error) || 'Failed to create manufacturer.';
		return rejectWithValue(message);
	}
});

export const listManufacturers = createAsyncThunk<
	ManufacturerListResponse,
	ListManufacturersParams,
	{ rejectValue: string }
>(
	'retailer/manufacturer/list',
	async ({ skip = 0, limit = 10, search, status }, { rejectWithValue }) => {
		try {
			const response = await axiosInstance.get('/api/v2/manufacturer/', {
				params: { skip, limit, ...(search ? { search } : {}), ...(status ? { status } : {}) },
			});
			return response.data as ManufacturerListResponse;
		} catch (error: any) {
			const message = formatApiError(error) || 'Failed to load manufacturers.';
			return rejectWithValue(message);
		}
	},
	{
		condition: (params, { getState }) => {
			if (params?.forceRefresh) return true;
			const state = getState() as any;
			const mfgState = state.retailerManufacturer;
			if (mfgState) {
				if (mfgState.listStatus === 'loading') {
					console.info('[ListManufacturers] Aborted list: already loading');
					return false;
				}
				const timeDiff = Date.now() - (mfgState.lastFetchedTimestamp || 0);
				if (timeDiff < 1000 && mfgState.items && mfgState.items.length > 0 && !params?.search && !params?.status && !params?.append) {
					console.info('[ListManufacturers] Aborted list: double-mount protection');
					return false;
				}
			}
		}
	}
);

export const fetchManufacturerById = createAsyncThunk<
	ManufacturerApiResponse,
	number,
	{ rejectValue: string }
>(
	'retailer/manufacturer/detail',
	async (manufacturerId, { rejectWithValue }) => {
		try {
			const response = await axiosInstance.get(`/api/v2/manufacturer/${manufacturerId}`);
			return response.data as ManufacturerApiResponse;
		} catch (error: any) {
			const message = formatApiError(error) || 'Failed to load manufacturer.';
			return rejectWithValue(message);
		}
	}
);

export const updateManufacturer = createAsyncThunk<
	ManufacturerApiResponse,
	{ manufacturerId: number; payload: UpdateManufacturerPayload },
	{ rejectValue: string }
>(
	'retailer/manufacturer/update',
	async ({ manufacturerId, payload }, { rejectWithValue }) => {
		try {
			const response = await axiosInstance.put(
				`/api/v2/manufacturer/${manufacturerId}`,
				payload
			);
			return response.data as ManufacturerApiResponse;
		} catch (error: any) {
			const message = formatApiError(error) || 'Failed to update manufacturer.';
			return rejectWithValue(message);
		}
	}
);

export const deleteManufacturer = createAsyncThunk<
	ManufacturerApiResponse,
	number,
	{ rejectValue: string }
>(
	'retailer/manufacturer/delete',
	async (manufacturerId, { rejectWithValue }) => {
		try {
			const response = await axiosInstance.delete(`/api/v2/manufacturer/${manufacturerId}`);
			return response.data as ManufacturerApiResponse;
		} catch (error: any) {
			const message = formatApiError(error) || 'Failed to delete manufacturer.';
			return rejectWithValue(message);
		}
	}
);

const manufacturerSlice = createSlice({
	name: 'retailerManufacturer',
	initialState,
	reducers: {
		resetManufacturers(state) {
			state.items = [];
			state.total = 0;
			state.listStatus = 'idle';
			state.listError = null;
			state.lastFetchedTimestamp = 0;
		}
	},
	extraReducers: (builder) => {
		builder
			.addCase(createManufacturer.pending, (state) => {
				state.createStatus = 'loading';
				state.createError = null;
			})
			.addCase(createManufacturer.fulfilled, (state, action) => {
				state.createStatus = 'succeeded';
				state.lastCreated = action.payload;
				state.items = [action.payload, ...state.items];
				state.total = (state.total || 0) + 1;
			})
			.addCase(createManufacturer.rejected, (state, action) => {
				state.createStatus = 'failed';
				state.createError = action.payload || 'Failed to create manufacturer.';
			})
			.addCase(listManufacturers.pending, (state) => {
				state.listStatus = 'loading';
				state.listError = null;
				state.lastFetchedTimestamp = Date.now();
			})
			.addCase(listManufacturers.fulfilled, (state, action) => {
				state.listStatus = 'succeeded';
				const fetchedItems = action.payload.items || [];
				const append = action.meta.arg?.append ?? false;
				if (append) {
					const existingIds = new Set(state.items.map((item) => item.id));
					const newItems = fetchedItems.filter((item) => !existingIds.has(item.id));
					if (newItems.length === 0) {
						state.total = state.items.length;
					} else {
						state.items = [...state.items, ...newItems];
						state.total = action.payload.total ?? action.payload.items?.length ?? 0;
					}
				} else {
					state.items = fetchedItems;
					state.total = action.payload.total ?? action.payload.items?.length ?? 0;
				}
			})
			.addCase(listManufacturers.rejected, (state, action) => {
				state.listStatus = 'failed';
				state.listError = action.payload || 'Failed to load manufacturers.';
			})
			.addCase(fetchManufacturerById.pending, (state) => {
				state.detailStatus = 'loading';
				state.detailError = null;
			})
			.addCase(fetchManufacturerById.fulfilled, (state, action) => {
				state.detailStatus = 'succeeded';
				state.detailItem = action.payload;
			})
			.addCase(fetchManufacturerById.rejected, (state, action) => {
				state.detailStatus = 'failed';
				state.detailError = action.payload || 'Failed to load manufacturer.';
			})
			.addCase(updateManufacturer.pending, (state) => {
				state.updateStatus = 'loading';
				state.updateError = null;
			})
			.addCase(updateManufacturer.fulfilled, (state, action) => {
				state.updateStatus = 'succeeded';
				state.lastUpdated = action.payload;
				state.detailItem = action.payload;
				state.items = state.items.map((item) =>
					item.id === action.payload.id ? action.payload : item
				);
			})
			.addCase(updateManufacturer.rejected, (state, action) => {
				state.updateStatus = 'failed';
				state.updateError = action.payload || 'Failed to update manufacturer.';
			})
			.addCase(deleteManufacturer.pending, (state) => {
				state.deleteStatus = 'loading';
				state.deleteError = null;
				state.lastDeletedId = null;
			})
			.addCase(deleteManufacturer.fulfilled, (state, action) => {
				state.deleteStatus = 'succeeded';
				state.lastDeletedId = action.payload.id;
				state.items = state.items.filter((item) => item.id !== action.payload.id);
				if (state.detailItem?.id === action.payload.id) {
					state.detailItem = null;
				}
				state.total = Math.max(0, (state.total || 0) - 1);
			})
			.addCase(deleteManufacturer.rejected, (state, action) => {
				state.deleteStatus = 'failed';
				state.deleteError = action.payload || 'Failed to delete manufacturer.';
			});
	},
});

export const { resetManufacturers } = manufacturerSlice.actions;
export default manufacturerSlice.reducer;
