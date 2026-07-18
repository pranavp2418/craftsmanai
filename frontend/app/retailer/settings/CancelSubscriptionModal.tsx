'use client';

import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { cancelSubscriptionPlan, resetCancelPlanState } from '@/redux/slices/retailer/billing/cancelPlanSlice';
import { toast } from 'react-toastify';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: () => void;
  onDowngrade: () => void;
  onPause: () => void;
  nextBillingDate?: string;
}

type CancelStage = 'warning' | 'offer' | 'reason' | 'confirm' | 'success';

const REASONS = [
  'Too expensive',
  'Not using the platform enough',
  'Found an alternative solution',
  'Store closed temporarily',
  'Other reason',
];

export default function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirmCancel,
  onDowngrade,
  onPause,
  nextBillingDate = 'August 12, 2026',
}: CancelSubscriptionModalProps) {
  const [stage, setStage] = useState<CancelStage>('warning');
  const [selectedReason, setSelectedReason] = useState<string>('Too expensive');
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((state) => state.retailerCancelPlan);
  const isLoading = status === 'loading';

  useEffect(() => {
    if (isOpen) {
      setStage('warning');
      setSelectedReason('Too expensive');
      dispatch(resetCancelPlanState());
    }
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  const handleKeepPlan = () => {
    onClose();
  };

  const handleContinueToOffer = () => {
    setStage('offer');
  };

  const handleContinueToReason = () => {
    setStage('reason');
  };

  const handleReasonSubmitted = () => {
    setStage('confirm');
  };


  const handleFinalCancel = async () => {
    try {
      await dispatch(cancelSubscriptionPlan({ cancellation_reason: selectedReason })).unwrap();
      setStage('success');
      setSelectedReason('Too expensive');
    } catch (err) {
      // Error is stored in Redux store state and will be displayed below the checklist
    }
  };

  const handleSuccessClose = () => {
    onConfirmCancel();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      {stage === 'warning' && (
        /* STAGE 1: Cancel Confirmation Warning Modal */
        <div className="relative w-full max-w-[480px] rounded-[24px] p-6 sm:p-8 bg-white dark:bg-surface-100 shadow-2xl flex flex-col items-center animate-scale-in">
          {/* Warning Icon badge */}
          <div className="w-12 h-12 rounded-full bg-[#FEF2F2] dark:bg-danger/15 text-[#EF4444] dark:text-danger flex items-center justify-center mb-4">
            <span className="ri-error-warning-line text-2xl"></span>
          </div>

          {/* Titles */}
          <h3 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-white text-center mb-2 leading-tight font-satoshi">
            Cancel Your Subscription?
          </h3>
          <p className="text-xs sm:text-sm text-[#4B5563] dark:text-[#A1A8B3] text-center mb-6 leading-relaxed">
            You will lose access to AI rendering tools, customer approval sharing, manufacturer quotations, and collaboration features.
          </p>

          {/* Features Checklist */}
          <div className="w-full bg-[#F9FAFB] dark:bg-surface-150 rounded-2xl p-5 mb-6 text-left">
            <p className="text-sm font-bold text-[#111827] dark:text-white mb-3">You&apos;ll lose access to:</p>
            <div className="flex flex-col gap-3">
              {[
                'Unlimited AI jewelery renders',
                'Customer approval dashboard',
                'Manufacturer quotation workflow',
                'Priority support',
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-3 text-xs sm:text-sm font-medium text-[#4B5563] dark:text-ink-500">
                  <span className="ri-close-circle-line text-lg text-[#EF4444] font-bold "></span>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 w-full">
            <button
              onClick={handleContinueToOffer}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-[#2F68C5] border border-[#2F68C5] hover:bg-blue-50 dark:hover:bg-blue-950/20 bg-white dark:bg-transparent transition-colors text-center cursor-pointer font-satoshi"
            >
              Continue Cancellation
            </button>
            <button
              onClick={handleKeepPlan}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-white bg-[#2F68C5] hover:bg-[#25529C] transition-colors text-center shadow-sm cursor-pointer font-satoshi dark:text-black"
            >
              Keep My Plan
            </button>
          </div>
        </div>
      )}

      {stage === 'offer' && (
        /* STAGE 2: Consider Smaller Plan Modal */
        <div className="relative w-full max-w-[500px] rounded-[24px] p-6 sm:p-8 bg-white dark:bg-surface-100 border border-gray-100 dark:border-border-default shadow-xl flex flex-col items-center animate-scale-in">
          {/* Top Down Arrow Icon */}
          <div className="w-12 h-12 rounded-full bg-[#EEF2FF] dark:bg-brand/15 text-[#2F68C5] dark:text-brand flex items-center justify-center mb-4">
            <span className="ri-arrow-down-circle-line text-2xl"></span>
          </div>

          {/* Titles */}
          <h3 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-white text-center mb-2 leading-tight font-satoshi whitespace-nowrap">
            Before you leave, consider a smaller plan
          </h3>
          <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#A1A8B3] text-center mb-6 leading-relaxed">
            If your current plan feels too large for your store's needs, you can switch to a smaller plan or pause instead of cancelling.
          </p>

          {/* Options Cards */}
          <div className="w-full flex flex-col gap-3 mb-6">
            {/* Downgrade Option */}
            <button
              onClick={onDowngrade}
              className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-border-default hover:border-gray-200 dark:hover:border-border-strong bg-white dark:bg-surface-150 transition-all text-left group"
            >
              <div>
                <p className="text-sm font-bold text-[#111827] dark:text-white">Downgrade to Plan</p>
                <p className="text-xs text-[#6B7280] dark:text-ink-450 mt-1">Perfect for smaller stores</p>
              </div>
              <span className="ri-arrow-right-line text-base text-[#9CA3AF] group-hover:text-[#2F68C5] dark:group-hover:text-brand transition-colors shrink-0"></span>
            </button>
          </div>

          {/* Bottom Buttons */}
          <div className="flex gap-4 w-full">
            <button
              onClick={handleContinueToReason}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-[#2F68C5] border border-[#2F68C5] hover:bg-gray-50  transition-colors text-center cursor-pointer"
            >
              Continue Cancellation
            </button>
            <button
              onClick={handleKeepPlan}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-white bg-[#2F68C5] hover:bg-[#25529C] transition-colors text-center shadow-sm cursor-pointer dark:text-black"
            >
              Keep My Plan
            </button>
          </div>
        </div>
      )}

      {stage === 'reason' && (
        /* STAGE 3: Help us improve (Reason Survey) */
        <div className="relative w-full max-w-[480px] rounded-[24px] p-6 sm:p-8 bg-white dark:bg-surface-100 border border-gray-100 dark:border-border-default shadow-xl flex flex-col items-center animate-scale-in">
          {/* Purple speech bubble icon */}
          <div className="w-12 h-12 rounded-full bg-[#F5F3FF] dark:bg-violet-accent/15 text-[#8B5CF6] dark:text-violet-accent flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <path d="M16 2H4C2.9 2 2 2.9 2 4V14C2 15.1 2.9 16 4 16H14L18 20V4C18 2.9 17.1 2 16 2ZM11 12H9V10H11V12ZM11 8H9V5H11V8Z" fill="currentColor" />
            </svg>
          </div>

          {/* Titles */}
          <h3 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-white text-center mb-2 leading-tight font-satoshi">
            Help us improve Craftsman.ai
          </h3>
          <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#A1A8B3] text-center mb-6 leading-relaxed">
            What is the main reason for cancelling?
          </p>

          {/* Reasons Radio Group */}
          <div className="w-full flex flex-col gap-3 mb-6">
            {REASONS.map((reason) => {
              const isSelected = selectedReason === reason;
              return (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full flex items-center gap-3.5 p-4 rounded-xl border transition-all text-left cursor-pointer ${isSelected
                    ? 'border-[#2F68C5] dark:border-brand bg-[#F0F5FF]/60 dark:bg-brand/10 text-[#2F68C5] dark:text-brand font-semibold'
                    : 'border-gray-200 dark:border-border-default hover:border-gray-300 dark:hover:border-border-strong bg-white dark:bg-surface-150 text-[#4B5563] dark:text-[#A1A8B3]'
                    }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-[#2F68C5] dark:border-brand' : 'border-[#D1D5DB] dark:border-border-strong'
                      }`}
                  >
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#2F68C5] dark:bg-brand" />}
                  </div>
                  <span className="text-sm">{reason}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom Buttons */}
          <div className="flex gap-4 w-full">
            <button
              onClick={handleReasonSubmitted}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-[#2F68C5] dark:text-brand border border-[#2F68C5] dark:border-brand hover:bg-gray-50 dark:hover:bg-surface-hover bg-white dark:bg-transparent transition-colors text-center cursor-pointer"
            >
              Submit &amp; Continue
            </button>
            <button
              onClick={handleKeepPlan}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-white bg-[#2F68C5] hover:bg-[#25529C] transition-colors text-center shadow-sm cursor-pointer dark:text-black"
            >
              Keep My Plan
            </button>
          </div>
        </div>
      )}

      {stage === 'confirm' && (
        /* STAGE 4: Confirm Cancellation */
        <div className="relative w-full max-w-[480px] rounded-[24px] p-6 sm:p-8 bg-white dark:bg-surface-100 border border-gray-100 dark:border-border-default shadow-xl flex flex-col items-center animate-scale-in">
          {/* Red X Icon */}
          <div className="w-12 h-12 rounded-full bg-[#FEF2F2] dark:bg-danger-light flex items-center justify-center mb-4">
            <div className="w-8 h-8 rounded-full bg-[#EF4444] text-white flex items-center justify-center shadow-sm">
              <span className="ri-close-line text-xl font-bold"></span>
            </div>
          </div>

          {/* Titles */}
          <h3 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-white text-center mb-2 leading-tight font-satoshi">
            Confirm Cancellation plan?
          </h3>
          <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#A1A8B3] text-center mb-6 leading-relaxed">
            Your plan will remain active until the end of the billing period on{' '}
            <span className="font-bold text-[#111827] dark:text-white">{nextBillingDate}</span>
          </p>

          {/* Information checklist */}
          <div className="w-full bg-[#F9FAFB] dark:bg-surface-150 rounded-2xl p-5 mb-6 border border-gray-100 dark:border-border-default flex flex-col gap-4 text-left">
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <span className="ri-calendar-line text-lg text-[#3B82F6] dark:text-brand"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#111827] dark:text-white">Access until billing end</p>
                <p className="text-xs text-[#6B7280] dark:text-ink-450 mt-0.5">
                  You can continue using all features until {nextBillingDate}.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <span className="ri-database-2-line text-lg text-[#10B981] dark:text-success-medium"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#111827] dark:text-white">Data preservation</p>
                <p className="text-xs text-[#6B7280] dark:text-ink-450 mt-0.5">
                  Your designs and customer data will be preserved for 90 days.
                </p>
              </div>
            </div>

            {/* <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                <span className="ri-refresh-line text-lg text-[#8B5CF6] dark:text-[#8B5CF6]"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#111827] dark:text-white">Easy reactivation</p>
                <p className="text-xs text-[#6B7280] dark:text-ink-450 mt-0.5">
                  You can reactivate your subscription anytime within 90 days.
                </p>
              </div>
            </div> */}
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-xs text-[#EF4444] font-medium text-center mb-4 leading-relaxed">
              {error}
            </p>
          )}

          {/* Bottom Buttons */}
          <div className="flex gap-4 w-full">
            <button
              disabled={isLoading}
              onClick={handleKeepPlan}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-[#EF4444] border border-[#EF4444] hover:bg-red-50/50 dark:hover:bg-red-950/20 bg-white dark:bg-transparent transition-colors text-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Keep my Plan
            </button>
            <button
              disabled={isLoading}
              onClick={handleFinalCancel}
              className="flex-1 py-3 rounded-full text-sm font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] transition-colors text-center shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed dark:text-black"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </button>
          </div>
        </div>
      )}

      {stage === 'success' && (
        /* STAGE 5: Cancellation Success */
        <div className="relative w-full max-w-[520px] rounded-[24px] p-6 sm:p-8 bg-white dark:bg-surface-100 border border-gray-100 dark:border-border-default shadow-xl flex flex-col items-center animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-[#E8F8F0] dark:bg-emerald-500/10 flex items-center justify-center mb-5">
            <div className="w-12 h-12 rounded-full bg-[#D1FAE5] dark:bg-emerald-500/20 flex items-center justify-center">
              <span className="ri-check-line text-3xl text-[#16A34A] dark:text-emerald-400"></span>
            </div>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-white text-center mb-2 leading-tight font-satoshi">
            Subscription Cancelled
          </h3>
          <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#A1A8B3] text-center mb-6 leading-relaxed max-w-[420px]">
            Your cancellation has been confirmed. You&apos;ll continue to have full access to Craftsman.ai until your billing period ends.
          </p>

          <div className="w-full rounded-2xl p-4 sm:p-5 mb-7 bg-[#F9FAFB] dark:bg-surface-150 border border-gray-100 dark:border-border-default flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#E8F8F0] dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                <span className="ri-calendar-check-line text-lg text-[#16A34A] dark:text-emerald-400"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#111827] dark:text-white">Active until {nextBillingDate}</p>
                <p className="text-xs text-[#6B7280] dark:text-ink-450 mt-0.5">
                  Full access remains until the end of your billing cycle.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#EFF6FF] dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                <span className="ri-database-2-line text-lg text-[#3B82F6] dark:text-blue-400"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#111827] dark:text-white">Data retained for 90 days</p>
                <p className="text-xs text-[#6B7280] dark:text-ink-450 mt-0.5">
                  All designs, requests, and customer data are safe.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#F5F3FF] dark:bg-violet-500/10 flex items-center justify-center shrink-0">
                <span className="ri-mail-send-line text-lg text-[#8B5CF6] dark:text-violet-400"></span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#111827] dark:text-white">Confirmation email sent</p>
                <p className="text-xs text-[#6B7280] dark:text-ink-450 mt-0.5">
                  Check your inbox for cancellation details.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSuccessClose}
            className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-[#2F68C5] hover:bg-[#25529C] transition-colors shadow-sm dark:text-black"
          >
            Close &amp; Return To Settings
          </button>
        </div>
      )}
    </div>
  );
}
