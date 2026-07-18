'use client';

import React from 'react';

interface OtpSentModalProps {
  isOpen: boolean;
  onContinue: () => void;
  message?: string;
}

export default function OtpSentModal({ isOpen, onContinue, message }: OtpSentModalProps) {
  if (!isOpen) return null;

  console.log(message)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[440px] rounded-[24px] p-6 sm:p-8 bg-white dark:bg-surface-100 border border-gray-100 dark:border-border-default shadow-xl flex flex-col items-center">

        {/* Success Icon */}
        <div className="w-14 h-14 rounded-full bg-[#E8F8F0] dark:bg-surface-150 flex items-center justify-center text-[#10B981] dark:text-success-medium mb-4">
          <span className="ri-checkbox-circle-line text-3xl"></span>
        </div>

        {/* Text Details */}
        <h3 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-white text-center mb-1">
          OTP sent successfully
        </h3>
        <p className="text-xs sm:text-sm text-[#6B7280] dark:text-[#A1A8B3] text-center mb-6">
          {message || 'OTP has been sent to your registered email.'}
        </p>

        {/* Continue Button */}
        <button
          type="button"
          onClick={onContinue}
          className="w-full py-3 rounded-full text-sm font-semibold text-[#2F68C5] dark:text-brand border border-[#2F68C5] dark:border-brand hover:bg-gray-50 dark:hover:bg-surface-hover bg-white dark:bg-transparent transition-colors"
        >
          Continue
        </button>

      </div>
    </div>
  );
}
