'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Copy, Archive, Loader2, X, Layers, Sparkles, Palette } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchSubscriptionPlans } from '@/redux/slices/admin/subscriptions/adminPlansSlice';
import {
  fetchTopUpPacks,
  updateTopUpPack,
  type TopUpPack,
} from '@/redux/slices/admin/subscriptions/adminTopUpPacksSlice';
import PlanModal from './CreatePlanModal';
import ArchivePlanModal from './ArchivePlanModal';

function EditPackModal({
  isOpen,
  onClose,
  pack,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  pack: TopUpPack | null;
  onSuccess?: () => void;
}) {
  const dispatch = useAppDispatch();
  const { updating } = useAppSelector((state) => state.adminTopUpPacks);
  const [renderCount, setRenderCount] = useState('');
  const [price, setPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<{ renders?: string; price?: string }>({});

  useEffect(() => {
    if (pack) {
      setRenderCount(String(pack.renders));
      setPrice(String(pack.price));
      setIsActive(Boolean(pack.is_active));
      setErrors({});
    }
  }, [pack, isOpen]);

  if (!isOpen || !pack) return null;

  const validate = () => {
    const nextErrors: { renders?: string; price?: string } = {};
    const parsedRenders = Number(renderCount);
    const parsedPrice = Number(price);

    if (!renderCount.trim()) {
      nextErrors.renders = 'Render count is required.';
    } else if (!Number.isInteger(parsedRenders) || parsedRenders <= 0) {
      nextErrors.renders = 'Render count must be a positive whole number.';
    }

    if (!price.trim()) {
      nextErrors.price = 'Price is required.';
    } else if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      nextErrors.price = 'Price must be greater than 0.';
    }

    setErrors(nextErrors);
    return {
      isValid: Object.keys(nextErrors).length === 0,
      renders: parsedRenders,
      price: parsedPrice,
    };
  };

  const handleSave = async () => {
    const result = validate();
    if (!result.isValid) return;

    try {
      await dispatch(
        updateTopUpPack({
          id: pack.id,
          renders: result.renders,
          price: result.price,
          is_active: isActive,
        }),
      ).unwrap();
      toast.success('Top-up pack updated successfully.');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to update top-up pack.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[460px] mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-[#111827]">Edit Top-Up Pack</h2>
            <p className="text-xs text-gray-500 mt-0.5">{`${pack.renders} extra renders`}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${isActive ? 'text-[#16A34A] bg-[#F0FDF4]' : 'text-gray-400 bg-gray-100'
                }`}
            >
              {isActive ? 'Enabled' : 'Disabled'}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-[#111827] mb-2">Render Count</label>
          <input
            type="number"
            min={1}
            step={1}
            value={renderCount}
            onChange={(e) => setRenderCount(e.target.value)}
            className={`w-full px-4 py-3 border rounded-xl text-[15px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6] transition-all ${errors.renders ? 'border-red-300' : 'border-gray-200'
              }`}
          />
          {errors.renders && <p className="mt-2 text-xs text-red-600">{errors.renders}</p>}
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-[#111827] mb-2">Price (USD)</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[15px] font-medium">
              $
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`w-full pl-8 pr-4 py-3 border rounded-xl text-[15px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 focus:border-[#3B82F6] transition-all ${errors.price ? 'border-red-300' : 'border-gray-200'
                }`}
            />
          </div>
          {errors.price && <p className="mt-2 text-xs text-red-600">{errors.price}</p>}
        </div>

        <div className="mb-8">
          <button
            type="button"
            onClick={() => setIsActive((value) => !value)}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${isActive ? 'border-[#16A34A]/20 bg-[#F0FDF4]' : 'border-gray-200 bg-gray-50'
              }`}
          >
            <span>
              <span className="block text-sm font-semibold text-[#111827]">Availability</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                {isActive ? 'Pack is enabled for purchase.' : 'Pack is currently hidden from purchase.'}
              </span>
            </span>
            <span
              className={`text-[12px] font-bold px-3 py-1 rounded-full ${isActive ? 'text-[#16A34A] bg-white' : 'text-gray-500 bg-white'
                }`}
            >
              {isActive ? 'Enabled' : 'Disabled'}
            </span>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={updating}
            className="flex-1 py-3 px-6 border border-gray-200 rounded-xl text-sm font-semibold text-[#374151] hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updating}
            className="flex-1 py-3 px-6 bg-[#3B82F6] text-white rounded-xl text-sm font-semibold hover:bg-[#2563EB] transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {updating && <Loader2 className="w-4 h-4 animate-spin" />}
            {updating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlanManagement() {
  const dispatch = useAppDispatch();
  const { plans, loading, error } = useAppSelector((state) => state.adminPlans);
  const {
    packs: topUpPacks,
    loading: topUpLoading,
    error: topUpError,
    updating: topUpUpdating,
  } = useAppSelector((state) => state.adminTopUpPacks);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isEditPackOpen, setIsEditPackOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<TopUpPack | null>(null);
  const planStripRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  const hasFetched = React.useRef(false);
  const lastTopUpError = React.useRef<string | null>(null);

  useEffect(() => {
    if (!hasFetched.current) {
      dispatch(fetchSubscriptionPlans());
      dispatch(fetchTopUpPacks());
      hasFetched.current = true;
    }
  }, [dispatch]);

  useEffect(() => {
    if (topUpError && topUpError !== lastTopUpError.current) {
      toast.error(topUpError);
      lastTopUpError.current = topUpError;
      return;
    }

    if (!topUpError) {
      lastTopUpError.current = null;
    }
  }, [topUpError]);

  const handleCreateNew = () => {
    setSelectedPlan(null);
    setIsModalOpen(true);
  };

  const handleEdit = (plan: any) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleArchive = (plan: any) => {
    setSelectedPlan(plan);
    setIsArchiveModalOpen(true);
  };

  const handleSuccess = () => {
    dispatch(fetchSubscriptionPlans());
  };

  const getBrandingText = (plan: any) => {
    const canUseLogo = Boolean(plan.can_use_logo);
    const canUseBrandName = Boolean(plan.can_use_brand_name);
    const canUseCustomColor = Boolean(plan.can_use_custom_color);

    if (!canUseLogo && !canUseBrandName && !canUseCustomColor) {
      return 'No branding on external pages';
    }

    if (canUseLogo && canUseBrandName && canUseCustomColor) {
      return 'Full custom branding';
    }

    if (canUseLogo && !canUseBrandName && !canUseCustomColor) {
      return 'Logo + Powered by CraftsmanAI';
    }

    if (canUseLogo && !canUseBrandName && canUseCustomColor) {
      return 'Logo + Powered by CraftsmanAI';
    }

    return 'Tailored';
  };

  const handleEditPack = (pack: TopUpPack) => {
    setSelectedPack(pack);
    setIsEditPackOpen(true);
  };

  const handlePlanStripWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const container = planStripRef.current;
    if (!container) return;

    if (container.scrollWidth <= container.clientWidth) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;

    event.preventDefault();
    container.scrollLeft += delta;
  };

  const handlePlanStripMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = planStripRef.current;
    if (!container || event.button !== 0) return;

    dragStateRef.current = {
      isDragging: true,
      startX: event.pageX - container.offsetLeft,
      scrollLeft: container.scrollLeft,
    };
  };

  const handlePlanStripMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = planStripRef.current;
    const dragState = dragStateRef.current;
    if (!container || !dragState.isDragging) return;

    event.preventDefault();
    const currentX = event.pageX - container.offsetLeft;
    const distance = currentX - dragState.startX;
    container.scrollLeft = dragState.scrollLeft - distance;
  };

  const stopPlanStripDrag = () => {
    dragStateRef.current.isDragging = false;
  };

  const handleTogglePack = async (pack: TopUpPack) => {
    try {
      await dispatch(
        updateTopUpPack({
          id: pack.id,
          renders: pack.renders,
          price: pack.price,
          is_active: !pack.is_active,
        }),
      ).unwrap();
      toast.success(pack.is_active ? 'Top-up pack disabled.' : 'Top-up pack enabled.');
    } catch (error) {
      toast.error(typeof error === 'string' ? error : 'Failed to update top-up pack.');
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 px-1">
        <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Plan Management</h1>
        <button
          onClick={handleCreateNew}
          className="w-full sm:w-auto bg-[#2F68C5] text-[#E9EFFD] px-6 py-2.5 rounded-full flex items-center justify-center gap-2 text-[16px] font-medium shadow-sm transition-all hover:bg-[#2556A3] active:scale-95"
        >
          <Plus className="w-5 h-5 text-[#E9EFFD]" strokeWidth={2.5} />
          Create New Plan
        </button>
      </div>

      {loading && plans.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-[24px] border border-gray-100 p-8 h-[500px] flex flex-col animate-pulse"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="h-7 w-32 bg-gray-200 rounded-lg"></div>
                <div className="h-5 w-16 bg-gray-100 rounded-full"></div>
              </div>
              <div className="h-4 w-full bg-gray-100 rounded-md mb-2"></div>
              <div className="h-4 w-2/3 bg-gray-50 rounded-md mb-8"></div>
              <div className="h-10 w-24 bg-gray-200 rounded-lg mb-8"></div>
              <div className="space-y-4 mb-8">
                <div className="h-3 w-full bg-gray-100 rounded-md"></div>
                <div className="h-3 w-full bg-gray-100 rounded-md"></div>
                <div className="h-3 w-3/4 bg-gray-100 rounded-md"></div>
              </div>
              <div className="mt-auto flex gap-3 pt-6">
                <div className="flex-1 h-10 bg-gray-200 rounded-xl"></div>
                <div className="flex-1 h-10 bg-gray-100 rounded-xl"></div>
                <div className="flex-1 h-10 bg-gray-100 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-12 text-center bg-white rounded-[32px] border-2 border-red-50/50 shadow-sm">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Network Error</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">{error}</p>
          <button
            onClick={() => dispatch(fetchSubscriptionPlans())}
            className="px-8 py-2 bg-[#FEE2E2] text-red-600 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-red-200 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : plans.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-[32px] border border-[#E5E7EB] shadow-sm">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Plans Yet</h3>
          <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
            Create your first subscription plan to get started. Plans define pricing, features, and
            usage limits for your retailers.
          </p>
          <button
            onClick={handleCreateNew}
            className="px-6 py-2.5 bg-[#2F68C5] text-white rounded-full text-sm font-bold hover:bg-[#2556A3] transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create First Plan
          </button>
        </div>
      ) : (
        <div
          ref={planStripRef}
          onMouseDown={handlePlanStripMouseDown}
          onMouseMove={handlePlanStripMouseMove}
          onMouseUp={stopPlanStripDrag}
          onMouseLeave={stopPlanStripDrag}
          className="flex items-stretch whitespace-nowrap overflow-x-auto gap-5 cursor-grab active:cursor-grabbing select-none pb-2"
        >
          {plans.map((plan) => {
            const isCustom = plan.name.toLowerCase() === 'custom' || plan.monthly_price === 0;

            const getRendersText = (renders: number) => {
              if (renders === -1) return 'Unlimited renders per month';
              return `${renders} renders per month`;
            };

            return (
              <div
                key={plan.id}
                className={`flex h-[470px] flex-shrink-0 self-stretch min-w-[280px] max-w-[300px] flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 relative ${plan.is_most_popular
                    ? 'border-2 border-[#2F68C5] shadow-xl z-0'
                    : 'border border-gray-200 shadow-sm'
                  }`}
              >
                {plan.is_most_popular && (
                  <div className="px-8 pt-4">
                    <div className="bg-[#2F68C5] text-white text-[12px] font-bold py-2 px-4 text-center uppercase tracking-wider rounded-full w-full">
                      Most Popular
                    </div>
                  </div>
                )}

                <div
                  className={`flex min-h-0 flex-1 flex-col rounded-b-2xl bg-white p-6 ${plan.is_most_popular ? 'pt-4' : 'pt-6'
                    }`}
                >
                  <div className="flex items-start justify-between mb-3 text-left">
                    <h3 className="text-[20px] font-bold text-[#111827] text-wrap break-all max-w-32">
                      {plan.name}
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${plan.is_active
                          ? 'bg-[#F0FDF4] text-[#16A34A] border-[#16A34A]/10'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                        }`}
                    >
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mb-4 text-left">
                    {isCustom ? (
                      <div className="flex flex-col">
                        <span className="text-[28px] font-extrabold text-[#111827] leading-tight">
                          Contact Sales
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline">
                        <span className="text-[32px] font-extrabold text-[#111827] tracking-tight">
                          ${plan.monthly_price}
                        </span>
                        <span className="text-gray-400 text-[14px] font-medium ml-1">/ month</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mb-5 text-left">
                    {isCustom ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
                          <span className="text-[13px] text-[#4B5563]">Custom</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* <Sparkles className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" /> */}
                          <Palette className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
                          <span className="text-[13px] text-[#4B5563]">Tailored</span>
                        </div>
                        {/* <div className="flex items-center gap-2">
                          <Palette className="w-3.5 h-3.5 text-[#2563EB] flex-shrink-0" />
                          <span className="text-[13px] text-[#4B5563]">{getBrandingText(plan)}</span>
                        </div> */}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <svg
                            width="12"
                            height="11"
                            viewBox="0 0 12 11"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0.560625 10.5C0.40365 10.5 0.270969 10.4436 0.162581 10.3308C0.0541937 10.2181 0 10.08 0 9.91667V0.583333C0 0.42 0.0541937 0.281944 0.162581 0.169167C0.270969 0.0563889 0.40365 0 0.560625 0H10.6519C10.8089 0 10.9415 0.0563889 11.0499 0.169167C11.1583 0.281944 11.2125 0.42 11.2125 0.583333V9.91667C11.2125 10.08 11.1583 10.2181 11.0499 10.3308C10.9415 10.4436 10.8089 10.5 10.6519 10.5H0.560625ZM10.0912 7V1.16667H1.12125V9.33333L6.7275 3.5L10.0912 7ZM10.0912 8.645L6.7275 5.145L2.70221 9.33333H10.0912V8.645ZM3.36375 4.66667C3.16192 4.66667 2.97505 4.61417 2.80312 4.50917C2.6312 4.40417 2.49478 4.26222 2.39387 4.08333C2.29296 3.90444 2.2425 3.71 2.2425 3.5C2.2425 3.29 2.29296 3.09556 2.39387 2.91667C2.49478 2.73778 2.6312 2.59583 2.80312 2.49083C2.97505 2.38583 3.16192 2.33333 3.36375 2.33333C3.56557 2.33333 3.75245 2.38583 3.92437 2.49083C4.0963 2.59583 4.23272 2.73778 4.33363 2.91667C4.43454 3.09556 4.485 3.29 4.485 3.5C4.485 3.71 4.43454 3.90444 4.33363 4.08333C4.23272 4.26222 4.0963 4.40417 3.92437 4.50917C3.75245 4.61417 3.56557 4.66667 3.36375 4.66667Z"
                              fill="#2563EB"
                            />
                          </svg>

                          <span className="text-[13px] text-[#4B5563]">
                            {getRendersText(plan.monthly_renders)}
                          </span>
                        </div>
                        {/* <div className="flex items-center gap-2">
                          <svg
                            width="17"
                            height="21"
                            viewBox="0 0 17 21"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M3.66602 16.125C3.66602 15.2772 3.87983 14.4917 4.30745 13.7683C4.71953 13.0683 5.27544 12.5122 5.97519 12.1C6.69827 11.6722 7.48354 11.4583 8.33102 11.4583C9.17849 11.4583 9.96377 11.6722 10.6868 12.1C11.3866 12.5122 11.9425 13.0683 12.3546 13.7683C12.7822 14.4917 12.996 15.2772 12.996 16.125H11.8298C11.8298 15.495 11.6704 14.9078 11.3516 14.3633C11.0406 13.8344 10.6208 13.4144 10.0921 13.1033C9.5478 12.7844 8.96079 12.625 8.33102 12.625C7.70124 12.625 7.11423 12.7844 6.56998 13.1033C6.04128 13.4144 5.62143 13.8344 5.31043 14.3633C4.99165 14.9078 4.83227 15.495 4.83227 16.125H3.66602ZM8.33102 10.875C7.69347 10.875 7.10645 10.7156 6.56998 10.3967C6.04128 10.0856 5.62143 9.66556 5.31043 9.13667C4.99165 8.6 4.83227 8.01278 4.83227 7.375C4.83227 6.73722 4.99165 6.15 5.31043 5.61333C5.62143 5.08444 6.04128 4.66444 6.56998 4.35333C7.10645 4.03444 7.69347 3.875 8.33102 3.875C8.96857 3.875 9.55558 4.03444 10.0921 4.35333C10.6208 4.66444 11.0406 5.08444 11.3516 5.61333C11.6704 6.15 11.8298 6.73722 11.8298 7.375C11.8298 8.01278 11.6704 8.6 11.3516 9.13667C11.0406 9.66556 10.6208 10.0856 10.0921 10.3967C9.55558 10.7156 8.96857 10.875 8.33102 10.875ZM8.33102 9.70833C8.75087 9.70833 9.13962 9.60333 9.49727 9.39333C9.85492 9.18333 10.1387 8.89944 10.3486 8.54167C10.5586 8.18389 10.6635 7.795 10.6635 7.375C10.6635 6.955 10.5586 6.56611 10.3486 6.20833C10.1387 5.85056 9.85492 5.56667 9.49727 5.35667C9.13962 5.14667 8.75087 5.04167 8.33102 5.04167C7.91117 5.04167 7.52242 5.14667 7.16477 5.35667C6.80712 5.56667 6.52333 5.85056 6.3134 6.20833C6.10348 6.56611 5.99852 6.955 5.99852 7.375C5.99852 7.795 6.10348 8.18389 6.3134 8.54167C6.52333 8.89944 6.80712 9.18333 7.16477 9.39333C7.52242 9.60333 7.91117 9.70833 8.33102 9.70833Z"
                              fill="#2563EB"
                            />
                          </svg>

                          <span className="text-[13px] text-[#4B5563]">
                            {getTeamText(plan.customer_shares)}
                          </span>
                        </div> */}
                        <div className="flex items-center gap-2">
                          <svg
                            width="15"
                            height="20"
                            viewBox="0 0 15 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M7.00762 4.16732C7.77007 4.16732 8.49888 4.30343 9.19405 4.57565C9.85933 4.8401 10.4517 5.21148 10.9712 5.68982C11.4907 6.16815 11.8925 6.71454 12.1766 7.32898C12.4681 7.97454 12.6139 8.64732 12.6139 9.34732C12.6139 9.93843 12.4718 10.4868 12.1878 10.9923C11.9112 11.4745 11.5375 11.8595 11.0665 12.1473C10.5881 12.4429 10.0649 12.5907 9.49679 12.5907H8.39797C8.13634 12.5907 7.91583 12.6859 7.73643 12.8765C7.55703 13.067 7.46733 13.2984 7.46733 13.5707C7.46733 13.8118 7.54582 14.0257 7.70279 14.2123C7.85977 14.399 7.93825 14.6168 7.93825 14.8657C7.93825 15.1301 7.84669 15.3576 7.66355 15.5482C7.48041 15.7387 7.26177 15.834 7.00762 15.834C6.24517 15.834 5.51635 15.6823 4.82118 15.379C4.1559 15.0834 3.56351 14.6654 3.044 14.1248C2.52449 13.5843 2.1227 12.9679 1.83865 12.2757C1.54713 11.5523 1.40137 10.794 1.40137 10.0007C1.40137 9.20732 1.54713 8.44898 1.83865 7.72565C2.1227 7.03343 2.52449 6.41704 3.044 5.87648C3.56351 5.33593 4.1559 4.91787 4.82118 4.62232C5.51635 4.31898 6.24517 4.16732 7.00762 4.16732ZM6.34608 13.5707C6.34608 13.1818 6.43765 12.824 6.62079 12.4973C6.80392 12.1707 7.05247 11.9101 7.36642 11.7157C7.68037 11.5212 8.02422 11.424 8.39797 11.424H9.49679C9.85559 11.424 10.1882 11.3307 10.4947 11.144C10.8012 10.9573 11.0441 10.7065 11.2235 10.3915C11.4029 10.0765 11.4926 9.72843 11.4926 9.34732C11.4926 8.63176 11.2908 7.96287 10.8871 7.34065C10.491 6.73398 9.9565 6.25176 9.28375 5.89398C8.58858 5.52065 7.83174 5.33398 7.01322 5.33398C6.19471 5.33398 5.43787 5.54787 4.74269 5.97565C4.06994 6.38787 3.53548 6.94398 3.1393 7.64398C2.72818 8.36732 2.52262 9.15287 2.52262 10.0007C2.52262 10.8018 2.70575 11.5523 3.07203 12.2523C3.43083 12.929 3.92044 13.4773 4.54087 13.8973C5.17624 14.3329 5.87142 14.5857 6.62639 14.6557C6.43952 14.3134 6.34608 13.9518 6.34608 13.5707ZM4.4848 10.0007C4.25308 10.0007 4.05499 9.9151 3.89054 9.74398C3.72609 9.57287 3.64387 9.36676 3.64387 9.12565C3.64387 8.88454 3.72609 8.67843 3.89054 8.50732C4.05499 8.33621 4.25308 8.25065 4.4848 8.25065C4.71653 8.25065 4.91462 8.33621 5.07907 8.50732C5.24352 8.67843 5.32574 8.88454 5.32574 9.12565C5.32574 9.36676 5.24352 9.57287 5.07907 9.74398C4.91462 9.9151 4.71653 10.0007 4.4848 10.0007ZM9.53043 10.0007C9.2987 10.0007 9.10062 9.9151 8.93617 9.74398C8.77172 9.57287 8.68949 9.36676 8.68949 9.12565C8.68949 8.88454 8.77172 8.67843 8.93617 8.50732C9.10062 8.33621 9.2987 8.25065 9.53043 8.25065C9.76215 8.25065 9.96024 8.33621 10.1247 8.50732C10.2891 8.67843 10.3714 8.88454 10.3714 9.12565C10.3714 9.36676 10.2891 9.57287 10.1247 9.74398C9.96024 9.9151 9.76215 10.0007 9.53043 10.0007ZM7.00762 8.25065C6.77589 8.25065 6.5778 8.1651 6.41335 7.99398C6.2489 7.82287 6.16668 7.61676 6.16668 7.37565C6.16668 7.13454 6.2489 6.92843 6.41335 6.75732C6.5778 6.58621 6.77589 6.50065 7.00762 6.50065C7.23934 6.50065 7.43743 6.58621 7.60188 6.75732C7.76633 6.92843 7.84855 7.13454 7.84855 7.37565C7.84855 7.61676 7.76633 7.82287 7.60188 7.99398C7.43743 8.1651 7.23934 8.25065 7.00762 8.25065Z"
                              fill="#2563EB"
                            />
                          </svg>

                          <span className="text-[13px] text-[#4B5563]">
                            {getBrandingText(plan)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="border-t border-gray-100 my-2"></div>

                  <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1 text-left">
                    {plan.feature_points?.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="mt-0.5 flex-shrink-0 text-[#10B981]"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                        <span className="text-[13px] text-[#4B5563] font-normal leading-normal">
                          {feature}
                        </span>
                      </div>

                    ))}

                  </div>

                  <div className="mt-5 shrink-0 pt-2">
                    <button
                      onClick={() => handleEdit(plan)}
                      className="w-full py-2.5 px-6 rounded-full border border-[#2F68C5] text-[14px] font-semibold text-[#2F68C5] hover:bg-gray-50 transition-all active:scale-[0.98]"
                    >
                      Edit Plan
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-14 px-1">
        <h2 className="text-xl font-bold text-[#111827]">Top-Up Management</h2>
        <p className="text-gray-500 text-sm mt-1">
          Manage render top-up packs, purchases, renewals, and retailer allocations.
        </p>

        <div className="bg-[#FFFFFF] rounded-2xl p-6 mt-6 border border-[#E5E7EB]">
          <h3 className="text-[16px] font-bold text-[#111827]">Top-Up Pack Configuration</h3>
          <p className="text-gray-400 text-sm mt-0.5 border-b border-[#E5E7EB] pb-4">
            Configure available top-up render packs and pricing.
          </p>

          {topUpLoading && topUpPacks.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gray-100" />
                    <div className="w-16 h-5 rounded-full bg-gray-100" />
                  </div>
                  <div className="h-5 w-32 bg-gray-100 rounded mb-2" />
                  <div className="h-8 w-24 bg-gray-100 rounded mb-2" />
                  <div className="h-4 w-full bg-gray-50 rounded mb-6" />
                  <div className="flex gap-3 mt-auto">
                    <div className="flex-1 h-10 bg-gray-100 rounded-xl" />
                    <div className="flex-1 h-10 bg-gray-100 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : topUpPacks.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <p className="text-sm text-gray-500">No top-up packs found.</p>
              <button
                onClick={() => dispatch(fetchTopUpPacks())}
                className="mt-4 rounded-full bg-[#2F68C5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2556A3]"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-6">
              {topUpPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center">
                      <Layers className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <span
                      className={`text-[12px] font-bold px-2.5 py-0.5 rounded-full ${pack.is_active ? 'text-[#16A34A] bg-[#F0FDF4]' : 'text-gray-400 bg-gray-100'
                        }`}
                    >
                      {pack.is_active ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <h4 className="text-[17px] font-bold text-[#111827] mb-1">{`${pack.renders} Extra Renders`}</h4>
                  <p className="text-[26px] font-extrabold text-[#111827] mb-2">
                    ${pack.price.toFixed(2)}
                  </p>
                  <p className="text-[13px] text-gray-400 mb-6 leading-relaxed">
                    Expires with subscription end date.
                  </p>

                  <div className="flex gap-3 mt-auto">
                    <button
                      onClick={() => handleEditPack(pack)}
                      disabled={topUpUpdating}
                      className="flex-1 py-2.5 px-4 border border-gray-200 rounded-xl text-[13px] font-semibold text-[#374151] hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleTogglePack(pack)}
                      disabled={topUpUpdating}
                      className={`flex-1 py-2.5 px-4 border rounded-xl text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${pack.is_active
                          ? 'border-[#FDE68A] text-[#D97706] hover:bg-[#FFFBEB]'
                          : 'border-green-200 text-green-600 hover:bg-green-50'
                        }`}
                    >
                      {pack.is_active ? (
                        <>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="flex-shrink-0"
                          >
                            <rect x="6" y="4" width="4" height="16" rx="1" />
                            <rect x="14" y="4" width="4" height="16" rx="1" />
                          </svg>
                          Disable
                        </>
                      ) : (
                        <>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="flex-shrink-0"
                          >
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          Enable
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
        initialData={selectedPlan}
      />

      <ArchivePlanModal
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onSuccess={handleSuccess}
        plan={selectedPlan}
      />

      <EditPackModal
        isOpen={isEditPackOpen}
        onClose={() => setIsEditPackOpen(false)}
        pack={selectedPack}
        onSuccess={() => dispatch(fetchTopUpPacks())}
      />
    </div>
  );
}
