import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axiosInstance from '@/src/utils/hooks/axios';
import formatApiError from '@/src/utils/formatApiError';

export interface CustomerEmailPayload {
	label: string;
	email: string;
}

export interface CreateCustomerPayload {
	full_name: string;
	tag: string;
	emails: CustomerEmailPayload[];
	phone_number: string;
	location: string;
	status: 'Active' | 'Inactive';
}

export interface UpdateCustomerPayload {
	full_name: string;
	tag: string;
	emails: CustomerEmailPayload[];
	phone_number: string;
	location: string;
	status: string;
}

export interface CustomerApiResponse {
	id: number;
	created_by_user_id: number;
	full_name: string;
	tag: string;
	emails: CustomerEmailPayload[];
	phone_number: string;
	location: string;
	status: string;
	public_token: string;
	created_at: string;
	updated_at: string;
	client_since?: string | null;
	last_interaction?: string | null;
	stats?: {
		total_requests?: number;
		active_projects?: number;
		total_spent?: number;
		last_interaction?: string | null;
	} | null;
	linked_projects?: {
		id: number;
		design_code?: string | null;
		name?: string | null;
		jewellery_type?: string | null;
		status?: string | null;
		thumbnail_url?: string | null;
	}[] | null;
	timeline?: {
		id: number;
		action_type?: string | null;
		message?: string | null;
		created_at?: string | null;
	}[] | null;
}

export interface CustomerListResponse {
	items: CustomerApiResponse[];
	total: number;
}

export interface ListCustomersParams {
	page?: number;
	skip?: number;
	limit?: number;
	search?: string;
	status?: string;
	append?: boolean;
}

interface CustomerState {
	createStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	createError: string | null;
	lastCreated: CustomerApiResponse | null;
	listStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	listError: string | null;
	items: CustomerApiResponse[];
	total: number;
	hasMore: boolean;
	detailStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	detailError: string | null;
	detailItem: CustomerApiResponse | null;
	updateStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	updateError: string | null;
	lastUpdated: CustomerApiResponse | null;
	deleteStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	deleteError: string | null;
	lastDeletedId: number | null;
}

const initialState: CustomerState = {
	createStatus: 'idle',
	createError: null,
	lastCreated: null,
	listStatus: 'idle',
	listError: null,
	items: [],
	total: 0,
	hasMore: true,
	detailStatus: 'idle',
	detailError: null,
	detailItem: null,
	updateStatus: 'idle',
	updateError: null,
	lastUpdated: null,
	deleteStatus: 'idle',
	deleteError: null,
	lastDeletedId: null,
};

export const createCustomer = createAsyncThunk<
	CustomerApiResponse,
	CreateCustomerPayload,
	{ rejectValue: string }
>('retailer/customer/create', async (payload, { rejectWithValue }) => {
	try {
		const response = await axiosInstance.post('/api/v2/customer/', payload, {
            withCredentials: true
        });
		return response.data as CustomerApiResponse;
	} catch (error: any) {
		const message = formatApiError(error) || 'Failed to create customer.';
		return rejectWithValue(message);
	}
});

export const listCustomers = createAsyncThunk<
	CustomerListResponse,
	ListCustomersParams,
	{ rejectValue: string }
>('retailer/customer/list', async ({ page, skip, limit = 10, search, status }, { rejectWithValue, signal }) => {
	try {
		const resolvedPage = page ?? (typeof skip === 'number' ? Math.floor(skip / limit) + 1 : 1);
		const response = await axiosInstance.get('/api/v2/customer/', {
			params: { page: resolvedPage, limit, ...(search ? { search } : {}), ...(status ? { status } : {}) },
			signal,
		});
		const data = response.data;
		if (Array.isArray(data)) {
			return { items: data, total: data.length } as CustomerListResponse;
		}
		const items = Array.isArray(data?.items)
			? data.items
			: Array.isArray(data?.results)
				? data.results
				: [];
		const total =
			typeof data?.total === 'number'
				? data.total
				: typeof data?.count === 'number'
					? data.count
					: items.length;
		return { items, total } as CustomerListResponse;
	} catch (error: any) {
		const message = formatApiError(error) || 'Failed to load customers.';
		return rejectWithValue(message);
	}
});

export const fetchCustomerById = createAsyncThunk<
	CustomerApiResponse,
	number,
	{ rejectValue: string }
>(
	'retailer/customer/detail',
	async (customerId, { rejectWithValue }) => {
		try {
			const response = await axiosInstance.get(`/api/v2/customer/${customerId}`);
			return response.data as CustomerApiResponse;
		} catch (error: any) {
			const message = formatApiError(error) || 'Failed to load customer.';
			return rejectWithValue(message);
		}
	}
);

export const updateCustomer = createAsyncThunk<
	CustomerApiResponse,
	{ customerId: number; payload: UpdateCustomerPayload },
	{ rejectValue: string }
>(
	'retailer/customer/update',
	async ({ customerId, payload }, { rejectWithValue }) => {
		try {
			const response = await axiosInstance.put(
				`/api/v2/customer/${customerId}`,
				payload
			);
			return response.data as CustomerApiResponse;
		} catch (error: any) {
			const message = formatApiError(error) || 'Failed to update customer.';
			return rejectWithValue(message);
		}
	}
);

export const deleteCustomer = createAsyncThunk<
	CustomerApiResponse,
	number,
	{ rejectValue: string }
>(
	'retailer/customer/delete',
	async (customerId, { rejectWithValue }) => {
		try {
			const response = await axiosInstance.delete(`/api/v2/customer/${customerId}`);
			return response.data as CustomerApiResponse;
		} catch (error: any) {
			const message = formatApiError(error) || 'Failed to delete customer.';
			return rejectWithValue(message);
		}
	}
);

const customerSlice = createSlice({
	name: 'retailerCustomer',
	initialState,
	reducers: {
		resetCreateCustomer(state) {
			state.createStatus = 'idle';
			state.createError = null;
			state.lastCreated = null;
		},
		resetCustomerList(state) {
			state.items = [];
			state.total = 0;
			state.hasMore = true;
			state.listStatus = 'idle';
			state.listError = null;
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(createCustomer.pending, (state) => {
				state.createStatus = 'loading';
				state.createError = null;
			})
			.addCase(createCustomer.fulfilled, (state, action) => {
				state.createStatus = 'succeeded';
				state.lastCreated = action.payload;
				state.items = [action.payload, ...state.items];
				state.total = (state.total || 0) + 1;
			})
			.addCase(createCustomer.rejected, (state, action) => {
				state.createStatus = 'failed';
				state.createError = action.payload || 'Failed to create customer.';
			})
			.addCase(listCustomers.pending, (state, action) => {
				state.listStatus = 'loading';
				state.listError = null;
				if (!action.meta.arg?.append) {
					state.hasMore = true;
					state.items = [];
				}
			})
			.addCase(listCustomers.fulfilled, (state, action) => {
				state.listStatus = 'succeeded';
				const fetchedItems = action.payload.items || [];
				const limit = action.meta.arg?.limit ?? 15;
				const append = action.meta.arg?.append ?? false;
				if (append) {
					const existingIds = new Set(state.items.map((item) => item.id));
					const newItems = fetchedItems.filter((item) => !existingIds.has(item.id));
					if (newItems.length === 0) {
						state.hasMore = false;
						state.total = state.items.length;
					} else {
						state.items = [...state.items, ...newItems];
						state.hasMore = fetchedItems.length === limit;
						state.total = action.payload.total ?? action.payload.items?.length ?? 0;
					}
				} else {
					state.items = fetchedItems;
					state.hasMore = fetchedItems.length === limit;
					state.total = action.payload.total ?? action.payload.items?.length ?? 0;
				}
			})
			.addCase(listCustomers.rejected, (state, action) => {
				if (action.meta.aborted) {
					return;
				}
				state.listStatus = 'failed';
				state.listError = action.payload || 'Failed to load customers.';
			})
			.addCase(fetchCustomerById.pending, (state) => {
				state.detailStatus = 'loading';
				state.detailError = null;
			})
			.addCase(fetchCustomerById.fulfilled, (state, action) => {
				state.detailStatus = 'succeeded';
				state.detailItem = action.payload;
			})
			.addCase(fetchCustomerById.rejected, (state, action) => {
				state.detailStatus = 'failed';
				state.detailError = action.payload || 'Failed to load customer.';
			})
			.addCase(updateCustomer.pending, (state) => {
				state.updateStatus = 'loading';
				state.updateError = null;
			})
			.addCase(updateCustomer.fulfilled, (state, action) => {
				state.updateStatus = 'succeeded';
				state.lastUpdated = action.payload;
				state.detailItem = action.payload;
				state.items = state.items.map((item) =>
					item.id === action.payload.id ? action.payload : item
				);
			})
			.addCase(updateCustomer.rejected, (state, action) => {
				state.updateStatus = 'failed';
				state.updateError = action.payload || 'Failed to update customer.';
			})
			.addCase(deleteCustomer.pending, (state) => {
				state.deleteStatus = 'loading';
				state.deleteError = null;
				state.lastDeletedId = null;
			})
			.addCase(deleteCustomer.fulfilled, (state, action) => {
				state.deleteStatus = 'succeeded';
				state.lastDeletedId = action.payload.id;
				state.items = state.items.filter((item) => item.id !== action.payload.id);
				if (state.detailItem?.id === action.payload.id) {
					state.detailItem = null;
				}
				state.total = Math.max(0, (state.total || 0) - 1);
			})
			.addCase(deleteCustomer.rejected, (state, action) => {
				state.deleteStatus = 'failed';
				state.deleteError = action.payload || 'Failed to delete customer.';
			});
	},
});

export const { resetCreateCustomer, resetCustomerList } = customerSlice.actions;
export default customerSlice.reducer;

