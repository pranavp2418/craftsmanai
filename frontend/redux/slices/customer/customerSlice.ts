import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import formatApiError from '@/src/utils/formatApiError';

export interface CustomerAccessDesign {
	design_id: number;
	design_code: string;
	name: string;
	jewellery_type: string;
	user_prompt: string;
	input_image_url: string | null;
	status: string;
	created_by?: string;
}

export interface CustomerAccessVariant {
	id: number;
	variant_name: string;
	version_number: number;
	base_design_image_url: string | null;
	angles_json: Record<string, unknown> | unknown[] | null;
	metal_variations_json: Record<string, unknown> | unknown[] | null;
	is_selected: boolean;
	created_at: string;
}

export interface CustomerAccessResponse {
	design: CustomerAccessDesign;
	variants: CustomerAccessVariant[];
	share_status: string;
	share_comment: string | null;
	public_token: string;
	require_approval: boolean;
	allow_feedback: boolean;
	allow_review_request: boolean;
	brand_logo_url?: string | null;
	brand_primary_color?: string | null;
	powered_by?: boolean;
	powered_by_craftsman_ai?: boolean;
	approved_manufacturer?: {
		name: string;
		deadline: string;
	} | null;
}

interface CustomerAccessState {
	data: CustomerAccessResponse | null;
	loading: boolean;
	error: string | null;
	approveStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	approveError: string | null;
	refinementStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	refinementError: string | null;
}

const initialState: CustomerAccessState = {
	data: null,
	loading: false,
	error: null,
	approveStatus: 'idle',
	approveError: null,
	refinementStatus: 'idle',
	refinementError: null,
};

export const fetchCustomerPublicAccess = createAsyncThunk<
	CustomerAccessResponse,
	{ token: string },
	{ rejectValue: string }
>(
	'customerAccess/fetchPublic',
	async ({ token }, { rejectWithValue }) => {
		try {
			const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
			const response = await axios.get(`${baseUrl}/api/v2/public/customer/access`, {
				params: { token },
			});
			return response.data as CustomerAccessResponse;
		} catch (error: any) {
			return rejectWithValue(formatApiError(error));
		}
	}
);

export const approveCustomerDesign = createAsyncThunk<
	{ success: boolean; message?: string },
	{ token: string; comment?: string },
	{ rejectValue: string }
>(
	'customerAccess/approveDesign',
	async ({ token, comment }, { rejectWithValue }) => {
		try {
			const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
			const response = await axios.post(`${baseUrl}/api/v2/public/approve`, {
				token,
				comment: comment ?? '',
			});
			return response.data as { success: boolean; message?: string };
		} catch (error: any) {
			return rejectWithValue(formatApiError(error));
		}
	}
);

export const requestCustomerRefinement = createAsyncThunk<
	{ success: boolean; message?: string },
	{ token: string; comment: string },
	{ rejectValue: string }
>(
	'customerAccess/requestRefinement',
	async ({ token, comment }, { rejectWithValue }) => {
		try {
			const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
			const response = await axios.post(`${baseUrl}/api/v2/public/request-refinement`, {
				token,
				comment,
			});
			return response.data as { success: boolean; message?: string };
		} catch (error: any) {
			return rejectWithValue(formatApiError(error));
		}
	}
);

const customerAccessSlice = createSlice({
	name: 'customerAccess',
	initialState,
	reducers: {
		clearCustomerAccess(state) {
			state.data = null;
			state.loading = false;
			state.error = null;
			state.approveStatus = 'idle';
			state.approveError = null;
				state.refinementStatus = 'idle';
				state.refinementError = null;
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(fetchCustomerPublicAccess.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchCustomerPublicAccess.fulfilled, (state, action) => {
				state.loading = false;
				state.data = action.payload;
			})
			.addCase(fetchCustomerPublicAccess.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload ?? 'Unknown error';
			})
			.addCase(approveCustomerDesign.pending, (state) => {
				state.approveStatus = 'loading';
				state.approveError = null;
			})
			.addCase(approveCustomerDesign.fulfilled, (state) => {
				state.approveStatus = 'succeeded';
			})
			.addCase(approveCustomerDesign.rejected, (state, action) => {
				state.approveStatus = 'failed';
				state.approveError = action.payload ?? 'Unable to approve design.';
			});
		builder
			.addCase(requestCustomerRefinement.pending, (state) => {
				state.refinementStatus = 'loading';
				state.refinementError = null;
			})
			.addCase(requestCustomerRefinement.fulfilled, (state) => {
				state.refinementStatus = 'succeeded';
			})
			.addCase(requestCustomerRefinement.rejected, (state, action) => {
				state.refinementStatus = 'failed';
				state.refinementError = action.payload ?? 'Unable to submit feedback.';
			});
	},
});

export const { clearCustomerAccess } = customerAccessSlice.actions;
export default customerAccessSlice.reducer;
