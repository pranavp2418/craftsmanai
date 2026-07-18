'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface OrderProgressProps {
  approved: boolean;
  deadline?: string;
  isInProduction?: boolean;
  isAwaitingApproval?: boolean;
  onApprove?: () => void;
  isApproving?: boolean;
  brandPrimaryColor?: string;
}

export default function OrderProgress({ approved, deadline, isInProduction, isAwaitingApproval, onApprove, isApproving, brandPrimaryColor = '#2563EB' }: OrderProgressProps) {
  return (
    <div className={`bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm w-full h-full`}>
      <h3 className="text-base md:text-lg font-medium text-gray-900 mb-4 sm:mb-5 md:mb-6">Order Progress</h3>

      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Approved */}
        <div className="flex items-center gap-3 sm:gap-4">
          {approved ? (
            <div className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: brandPrimaryColor }}>
              <Check className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
          ) : (
            <div className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full border-2 border-gray-300 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
            </div>
          )}
          <p className={`text-sm sm:text-base font-medium ${approved ? 'text-gray-900' : 'text-gray-500'}`}>Approved</p>
        </div>

        {/* Deadline */}
        <div className="flex items-center gap-3 sm:gap-4">
          {deadline ? (
            <div className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: brandPrimaryColor }}>
              <Check className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
          ) : (
            <div className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full border-2 border-gray-300 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
            </div>
          )}
          <div>
            <p className={`text-sm sm:text-base font-medium ${deadline ? 'text-gray-900' : 'text-gray-500'}`}>Deadline</p>
            <p className="text-sm text-gray-500">{deadline ?? 'DD - MM - YYYY'}</p>
          </div>
        </div>
      </div>

      {isAwaitingApproval && onApprove && (
        <button
          type="button"
          onClick={onApprove}
          disabled={isApproving}
          className="mt-6 w-full rounded-lg text-white text-sm sm:text-base font-semibold py-2.5 sm:py-3 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: brandPrimaryColor }}
        >
          {isApproving ? 'Submitting approval...' : 'Approve Design'}
        </button>
      )}
    </div>
  );
}
