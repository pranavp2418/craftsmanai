'use client';

import React from 'react';

interface ManagePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePlan: () => void;
  onCancelSubscription: () => void;
}

export default function ManagePlanModal({
  isOpen,
  onClose,
  onChangePlan,
  onCancelSubscription,
}: ManagePlanModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[640px] rounded-[24px] p-6 sm:p-8 bg-white dark:bg-surface-100 border border-border-default dark:border-border-default shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-satoshi">
            Manage Plan
          </h3>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <span className="ri-close-line text-lg text-slate-500 dark:text-slate-400"></span>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-6">
          Choose an action to manage your subscription.
        </p>

        {/* Options Stack */}
        <div className="flex flex-col gap-4">
          
          {/* Change Plan Card */}
          <button
            onClick={onChangePlan}
            className="group flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-border-default dark:border-border-default bg-white dark:bg-surface-150 hover:border-blue-500 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                <span className="ri-refresh-line text-xl"></span>
              </div>

              <div>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Change Plan
                </p>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 pr-4">
                  Switch to a different subscription plan that fits your
                  store&apos;s design volume.
                </p>
              </div>
            </div>

            <span className="ri-arrow-right-line text-base text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors shrink-0"></span>
          </button>

          {/* Cancel Subscription Card */}
          <button
            onClick={onCancelSubscription}
            className="group flex items-center justify-between p-4 sm:p-5 rounded-2xl border border-border-default dark:border-border-default bg-white dark:bg-surface-150 hover:border-red-500 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 shrink-0">
                <span className="ri-close-circle-line text-xl"></span>
              </div>

              <div>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Cancel Subscription
                </p>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 pr-4">
                  Cancel your subscription if you no longer wish to continue
                  using Craftsman.ai.
                </p>
              </div>
            </div>

            <span className="ri-arrow-right-line text-base text-slate-400 dark:text-slate-500 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors shrink-0"></span>
          </button>

        </div>
      </div>
    </div>
  );
}