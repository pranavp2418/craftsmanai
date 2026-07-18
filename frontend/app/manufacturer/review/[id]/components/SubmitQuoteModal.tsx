'use client';

import React, { useRef } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';

interface SubmitQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  productName: string;
  jobId: string;
  retailer: string;
  price: string;
  leadTime: string;
  loading?: boolean;
  brandPrimaryColor?: string;
}

export default function SubmitQuoteModal({
  isOpen,
  onClose,
  onConfirm,
  productName,
  jobId,
  retailer,
  price,
  leadTime,
  loading = false,
  brandPrimaryColor = '#3B82F6',
}: SubmitQuoteModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/20 backdrop-blur-sm bg-opacity-50 px-4 z-[9999]">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-8 md:py-5 w-full max-w-md shadow-2xl "
      >
        <div className='max-h-[75vh] overflow-y-auto'>
        {/* Warning Icon */}
        <div className="flex justify-center mb-4 sm:mb-5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#FFECD1] flex items-center justify-center">
            <CircleAlert className="w-6 h-6 sm:w-7 sm:h-7 text-[#FDA018]" />
          </div>
        </div>

        {/* Title and Subtitle */}
        <h2 className="text-xl sm:text-2xl font-medium text-gray-900 text-center mb-2 sm:mb-3">
          Submit this quote?
        </h2>
        <p className="text-sm sm:text-base text-gray-600 text-center mb-6 sm:mb-8">
          Once submitted, this quote cannot be edited.
        </p>

        {/* Product Details */}
        <div className="bg-[#F9F9F9] rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-5 sm:mb-6 space-y-3 sm:space-y-4">
          <div>
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Product</p>
            <p className="text-sm sm:text-base font-medium text-gray-900">{productName}</p>
          </div>

          <div className="border-t border-gray-200 pt-3 sm:pt-4">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Job ID</p>
            <p className="text-sm sm:text-base font-medium text-gray-900">{jobId}</p>
          </div>

          <div className="border-t border-gray-200 pt-3 sm:pt-4">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Retailer</p>
            <p className="text-sm sm:text-base font-medium text-gray-900">{retailer}</p>
          </div>

          <div className="border-t border-gray-200 pt-3 sm:pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Your Price</p>
              <p className="text-sm sm:text-base font-medium text-gray-900">{price}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Lead Time</p>
              <p className="text-sm sm:text-base font-medium text-gray-900">{leadTime}</p>
            </div>
          </div>
        </div>

        {/* Warning Note */}
        <div className="bg-[#FFECD1] border border-[#FDA018] rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-5 sm:mb-6">
          <p className="text-xs sm:text-sm text-[#FDA018]">
            <span className="font-semibold">Note:</span> Please verify all details are correct. This submission is final and cannot be changed.
          </p>
        </div>

        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer px-4 sm:px-6 py-2.5 sm:py-3 border rounded-lg font-medium hover:bg-black/5 transition-colors text-sm sm:text-base"
            style={{ borderColor: brandPrimaryColor, color: brandPrimaryColor }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 cursor-pointer px-4 text-nowrap sm:px-6 py-2.5 sm:py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity text-sm sm:text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: brandPrimaryColor }}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
            ) : (
              'Submit Quote'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
