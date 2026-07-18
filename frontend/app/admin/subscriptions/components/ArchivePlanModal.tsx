import React, { useEffect, useRef } from 'react';
import { Archive, Loader2, PlayCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { updateSubscriptionPlan, resetUpdatePlan } from '@/redux/slices/admin/subscriptions/adminUpdatePlanSlice';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  plan?: any;
}

export default function ArchivePlanModal({ isOpen, onClose, onSuccess, plan }: Props) {
  const dispatch = useAppDispatch();
  const { loading: archiving, success: archiveSuccess, error: archiveError } = useAppSelector((s) => s.adminUpdatePlan);
  const isResuming = !plan?.is_active;
  
  // Track if success has been handled to prevent double API trigger
  const handledSuccess = useRef(false);

  useEffect(() => {
    if (archiveSuccess && isOpen && !handledSuccess.current) {
      handledSuccess.current = true;
      toast.success(isResuming ? 'Plan resumed successfully.' : 'Plan archived successfully.');
      dispatch(resetUpdatePlan());
      onSuccess?.();
      onClose();
    }
  }, [archiveSuccess, isOpen, dispatch, onSuccess, onClose, isResuming]);

  useEffect(() => {
    if (archiveError) {
      toast.error(archiveError);
    }
  }, [archiveError]);

  // Reset the success tracker when the modal is closed
  useEffect(() => {
    if (!isOpen) {
      handledSuccess.current = false;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = () => {
    if (!plan?.id) return;
    handledSuccess.current = false; // Reset before starting a new action
    
    // Preparation of the payload: toggling state exactly once
    const payload = {
      name: plan.name,
      description: plan.description,
      price: plan.price || plan.monthly_price,
      monthly_price: plan.monthly_price,
      yearly_price: plan.yearly_price,
      duration_days: plan.duration_days || 30,
      is_active: !plan.is_active,
      is_most_popular: plan.is_most_popular,
      feature_points: plan.feature_points || [],
      monthly_renders: plan.monthly_renders,
      customer_shares: plan.customer_shares,
      manufacturer_quotes: plan.manufacturer_quotes,
      can_use_logo: Boolean(plan.can_use_logo ?? false),
      can_use_brand_name: Boolean(plan.can_use_brand_name ?? false),
      can_use_custom_color: Boolean(plan.can_use_custom_color ?? false),
      has_unlimited_renders: Boolean(plan.has_unlimited_renders ?? false),
    };

    dispatch(updateSubscriptionPlan({ plan_id: plan.id, payload }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-[500px] rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-8 sm:p-10 flex flex-col items-center text-center">

          {/* Top Icon */}
          <div className={`w-16 h-16 ${isResuming ? 'bg-[#F0FDF4]' : 'bg-[#FEF2F2]'} rounded-full flex items-center justify-center mb-6`}>
            {isResuming ? (
              <PlayCircle className="w-8 h-8 text-[#16A34A]" strokeWidth={2} />
            ) : (
              <Archive className="w-8 h-8 text-[#DC2626]" strokeWidth={2} />
            )}
          </div>

          {/* Title */}
          <h2 className="text-[20px] font-bold text-[#1E1E1E] mb-2 uppercase tracking-wide">
            {isResuming ? 'Resume' : 'Archive'} {plan?.name || 'Plan'}
          </h2>

          {/* Error Message */}
          {archiveError && (
            <div className="mb-4 text-xs font-semibold text-red-600 bg-red-50 p-2 rounded-lg w-full">
              {archiveError}
            </div>
          )}

          {/* Paragraph */}
          <p className="text-[14px] text-[#6B7280] leading-relaxed mb-10 max-w-[380px] font-medium font-sans text-center">
            {isResuming 
              ? `You are about to resume the ${plan?.name || 'Plan'}. This will reactivate the plan for new subscriptions immediately.`
              : `You are about to archive the ${plan?.name || 'Plan'}. This will deactivate the plan for all future subscriptions.`
            }
          </p>

          {/* Buttons Row */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={onClose}
              disabled={archiving}
              className="flex-1 py-3 px-6 border border-gray-100 text-[#6B7280] text-sm font-bold rounded-full transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAction}
              disabled={archiving}
              className={`flex-1 py-3 px-6 ${isResuming ? 'bg-[#16A34A] hover:bg-[#15803D] shadow-[#F0FDF4]' : 'bg-[#DC2626] hover:bg-[#B91C1C] shadow-red-100'} text-white text-sm font-bold rounded-full transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70`}
            >
              {archiving && <Loader2 className="w-4 h-4 animate-spin" />}
              {archiving ? (isResuming ? 'Resuming...' : 'Archiving...') : (isResuming ? 'Confirm Resume' : 'Confirm Archive')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
