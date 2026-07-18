'use client';

import React, { useRef } from 'react';
import { CircleCheck, CircleAlert } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';

interface QuoteSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandPrimaryColor?: string;
}

export default function QuoteSuccessModal({
  isOpen,
  onClose,
  brandPrimaryColor = '#3B82F6',
}: QuoteSuccessModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm bg-opacity-50 px-4 mt-0">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-10 w-full max-w-md shadow-2xl"
      >
        {/* Success Icon */}
        <div className="flex justify-center mb-4 sm:mb-5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#DCFCE7] flex items-center justify-center">
            <CircleCheck className="w-6 h-6 sm:w-7 sm:h-7 text-[#22A121]" />
          </div>
        </div>

        {/* Title and Subtitle */}
        <h2 className="text-xl sm:text-2xl font-medium text-gray-900 text-center mb-2 sm:mb-3">
          Quote Submitted
        </h2>
        <p className="text-sm sm:text-base text-gray-600 text-center mb-6 sm:mb-8">
          Your quote has been submitted successfully.
        </p>

        {/* What happens next - Info Box */}
        <div className="bg-[#EBF3FE] border-2 border-[#C2D8FC] rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-5 sm:mb-6">
          <div className="flex items-start gap-3">
            <CircleAlert className="w-5 h-5 sm:w-6 sm:h-6 text-[#3575DD] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-[#3575DD] mb-2">
                What happens next?
              </h3>
              <p className="text-xs sm:text-sm text-[#3575DD]">
                You&apos;ll be notified once the retailer reviews your quote. The quote is now locked and cannot be edited.
              </p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className='w-full flex items-center justify-end'>
          <button
            type="button"
            onClick={onClose}
            className="ml-full cursor-pointer px-4 sm:px-6 py-2.5 sm:py-3 border rounded-lg font-medium hover:bg-black/5 transition-colors text-sm sm:text-base"
            style={{ borderColor: brandPrimaryColor, color: brandPrimaryColor }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
