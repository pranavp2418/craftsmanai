import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import axios from 'axios';
import formatApiError from '@/src/utils/formatApiError';

type JsonLike = Record<string, unknown> | unknown[] | null;

export interface ManufacturerPublicDesign {
	design_id?: number;
	design_code?: string;
	name?: string;
	jewellery_type?: string;
	user_prompt?: string;
	input_image_url?: string | null;
	status?: string;
}

export interface ManufacturerPublicVariant {
	id: number;
	variant_name?: string;
	version_number?: number;
	base_design_image_url?: string | null;
	angles_json?: JsonLike;
	metal_variations_json?: JsonLike;
	is_selected?: boolean;
	created_at?: string;
}

export interface ManufacturerPublicAccessResponse {
	design?: ManufacturerPublicDesign;
	variants?: ManufacturerPublicVariant[];
	production_sheet?: Record<string, unknown>;
	order_progress?: Record<string, boolean>;
	request_title?: string;
	request_sku?: string;
	company_name?: string;
	order_details?: Record<string, unknown>;
	last_updated_at?: string;
	request_id?: string;
	manufacturer_id?: string;
	render_id?: string;
	share_status?: string;
	share_comment?: string | null;
	public_token?: string;
	brand_logo_url?: string | null;
	brand_primary_color?: string | null;
	powered_by?: boolean;
	powered_by_craftsman_ai?: boolean;
}

export interface SubmitManufacturerQuotePayload {
	share_token: string;
	cost_price: number;
	delivery_time_days: number;
	notes: string;
}

interface ManufacturerPublicAccessState {
	data: ManufacturerPublicAccessResponse | null;
	loading: boolean;
	error: string | null;
	quoteStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
	quoteError: string | null;
}

const initialState: ManufacturerPublicAccessState = {
	data: null,
	loading: false,
	error: null,
	quoteStatus: 'idle',
	quoteError: null,
};

export const fetchManufacturerPublicAccess = createAsyncThunk<
	ManufacturerPublicAccessResponse,
	{ token: string },
	{ rejectValue: string }
>(
	'manufacturerAccess/fetchPublic',
	async ({ token }, { rejectWithValue }) => {
		try {
			const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
			const response = await axios.get(`${baseUrl}/api/v2/public/manufacturer/variant/access`, {
				params: { share_token : token },
			});
			return response.data as ManufacturerPublicAccessResponse;
		} catch (error: any) {
			return rejectWithValue(formatApiError(error));
		}
	}
);

export const submitManufacturerQuote = createAsyncThunk<
	Record<string, unknown>,
	SubmitManufacturerQuotePayload,
	{ rejectValue: string }
>(
	'manufacturerAccess/submitQuote',
	async (payload, { rejectWithValue }) => {
		try {
			const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
			const response = await axios.post(`${baseUrl}/api/v2/public/manufacturer/variant/quote`, payload);
			return response.data as Record<string, unknown>;
		} catch (error: any) {
			return rejectWithValue(formatApiError(error));
		}
	}
);

const manufacturerAccessSlice = createSlice({
	name: 'manufacturerAccess',
	initialState,
	reducers: {
		clearManufacturerPublicAccess(state) {
			state.data = null;
			state.loading = false;
			state.error = null;
			state.quoteStatus = 'idle';
			state.quoteError = null;
		},
	},
	extraReducers: (builder) => {
		builder
			.addCase(fetchManufacturerPublicAccess.pending, (state) => {
				state.loading = true;
				state.error = null;
			})
			.addCase(fetchManufacturerPublicAccess.fulfilled, (state, action) => {
				state.loading = false;
				state.data = action.payload;
			})
			.addCase(fetchManufacturerPublicAccess.rejected, (state, action) => {
				state.loading = false;
				state.error = action.payload ?? 'Unable to load manufacturer access data.';
			})
			.addCase(submitManufacturerQuote.pending, (state) => {
				state.quoteStatus = 'loading';
				state.quoteError = null;
			})
			.addCase(submitManufacturerQuote.fulfilled, (state) => {
				state.quoteStatus = 'succeeded';
			})
			.addCase(submitManufacturerQuote.rejected, (state, action) => {
				state.quoteStatus = 'failed';
				state.quoteError = action.payload ?? 'Unable to submit quote.';
			});
	},
});

export const { clearManufacturerPublicAccess } = manufacturerAccessSlice.actions;
export default manufacturerAccessSlice.reducer;
