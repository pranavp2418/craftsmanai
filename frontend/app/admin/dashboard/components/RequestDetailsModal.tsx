'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';
import { type RequestStatusRecord } from './RequestStatusTable';

interface RequestDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: RequestStatusRecord | null;
}

const statusConfig: Record<
  RequestStatusRecord['currentStatus'],
  { badgeClass: string }
> = {
  'Awaiting Customer Approval': { badgeClass: 'bg-[#DCFCE7] text-[#16A34A]' },
  'Customer Approved': { badgeClass: 'bg-[#DCFCE7] text-[#16A34A]' },
  'Generated': { badgeClass: 'bg-[#FFECD1] text-[#F89402]' },
  'Quotation in Progress': { badgeClass: 'bg-[#FFECD1] text-[#F89402]' },
  'Quote Requested': { badgeClass: 'bg-[#FFECD1] text-[#F89402]' },
  'Production Completed': { badgeClass: 'bg-[#DBEAFE] text-[#2563EB]' },
  'In Production': { badgeClass: 'bg-[#DBEAFE] text-[#2563EB]' },
  'Manufacturer Approved': { badgeClass: 'bg-[#DCFCE7] text-[#16A34A]' },
  'Refinement Requested': { badgeClass: 'bg-[#FEE2E2] text-[#DC2626]' },
  'Detected': { badgeClass: 'bg-[#F3E8FF] text-[#7C3AED]' },
};

export default function RequestDetailsModal({
  isOpen,
  onClose,
  request,
}: RequestDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useClickOutside(modalRef, onClose);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const config = statusConfig[request.currentStatus];

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[50] transition-opacity" />

      {/* Modal */}
      <div className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-4 md:p-5 lg:p-6">
        <div
          ref={modalRef}
          className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-3 sm:px-3 mx-2.5 sm:mx-3 py-3 sm:py-3.5 md:py-4 border-b-2 border-gray-200">
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 leading-tight sm:leading-snug">
                Request Details
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer shrink-0 ml-3 sm:ml-4"
              aria-label="Close modal"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="bg-[#F9F9F9] m-3 sm:m-3.5 md:m-4 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5 lg:p-6 space-y-3 sm:space-y-3.5 md:space-y-4">
            {/* Request ID & Jewellery Type */}
            <div className="grid grid-cols-2 gap-3 sm:gap-3.5 md:gap-4 border-b-2 border-gray-200 pb-2.5 sm:pb-3">
              <div>
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                  Request ID
                </p>
                <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-tight sm:leading-snug">
                  {request.requestId}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                  Jewelery Type
                </p>
                <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-tight sm:leading-snug">
                  {request.jewelleryType}
                </p>
              </div>
            </div>

            {/* Retailer & Customer */}
            <div className="grid grid-cols-2 gap-3 sm:gap-3.5 md:gap-4 border-b-2 border-gray-200 pb-2.5 sm:pb-3">
              <div>
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                  Retailer
                </p>
                <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-tight sm:leading-snug break-words">
                  {request.retailer}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                  Customer
                </p>
                <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-tight sm:leading-snug">
                  {request.customer}
                </p>
              </div>
            </div>

            {/* Current Status */}
            <div className="border-b-2 border-gray-200 pb-2.5 sm:pb-3 flex items-center justify-between">
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-1 sm:mb-1.5 leading-tight w-auto">
                Current Status
              </p>
              <span
                className={`inline-flex items-center px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 md:py-1 rounded-full text-[10px] sm:text-xs md:text-sm font-medium leading-tight ${config.badgeClass}`}
              >
                {request.currentStatus}
              </span>
            </div>

            {/* Created Date & Last Updated */}
            <div className="grid grid-cols-2 gap-3 sm:gap-3.5 md:gap-4">
              <div>
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                  Created Date
                </p>
                <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-tight sm:leading-snug">
                  {request.createdDate}
                </p>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                  Last Updated
                </p>
                <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-tight sm:leading-snug">
                  {request.lastUpdated || request.createdDate}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 sm:px-3 mx-2.5 sm:mx-3 py-3 sm:py-3.5 md:py-4 border-t-2 border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 bg-[#EBF3FE] text-gray-700 text-xs sm:text-sm md:text-base font-medium rounded-full hover:bg-[#D6E7FD] transition-colors cursor-pointer leading-tight sm:leading-normal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
    , document.body);
}
