'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';
import { type ActivityRecord } from './RecentActivityTable';

interface ActivityDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ActivityRecord | null;
}

const actorTypeConfig: Record<
  ActivityRecord['actorType'],
  { badgeClass: string }
> = {
  Retailer: { badgeClass: 'bg-[#DCFCE7] text-[#16A34A]' },
  Customer: { badgeClass: 'bg-[#DBEAFE] text-[#2563EB]' },
  Manufacturer: { badgeClass: 'bg-[#FFECD1] text-[#F89402]' },
  System: { badgeClass: 'bg-[#F1F1F1] text-[#6B7280]' },
  Admin: { badgeClass: 'bg-[#F3E8FF] text-[#9333EA]' },
};

export default function ActivityDetailsModal({
  isOpen,
  onClose,
  activity,
}: ActivityDetailsModalProps) {
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

  if (!isOpen || !activity) return null;

  const config = actorTypeConfig[activity.actorType];

  const modalContent = (
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
          <div className="flex items-start justify-between mx-2.5 sm:mx-3 px-3 sm:px-3 py-3 sm:py-3.5 md:py-4 border-b-2 border-gray-200">
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 leading-tight sm:leading-snug">
                Activity Details
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
            {/* Timestamp */}
            <div className="border-b-2 border-gray-200 pb-2.5 sm:pb-3">
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                Timestamp
              </p>
              <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-tight sm:leading-snug">
                {activity.timestamp}
              </p>
            </div>

            {/* Actor Type */}
            <div className="border-b-2 border-gray-200 pb-2.5 sm:pb-3 flex items-center justify-between">
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-1 sm:mb-1.5 leading-tight">
                Actor Type
              </p>
              <span
                className={`inline-flex items-center px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 md:py-1 rounded-full text-[10px] sm:text-xs md:text-sm font-medium leading-tight ${config.badgeClass}`}
              >
                {activity.actorType}
              </span>
            </div>

            {/* Actor */}
            <div className="border-b-2 border-gray-200 pb-2.5 sm:pb-3">
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                Actor
              </p>
              <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-tight sm:leading-snug">
                {activity.actor}
              </p>
            </div>

            {/* Action */}
            <div className="border-b-2 border-gray-200 pb-2.5 sm:pb-3">
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                Action
              </p>
              <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 leading-tight sm:leading-snug">
                {activity.action}
              </p>
            </div>

            {/* Reference ID */}
            <div>
              <p className="text-[10px] sm:text-xs md:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">
                Reference ID
              </p>
              <p className="text-sm sm:text-base md:text-lg font-medium text-[#2F68C5] leading-tight sm:leading-snug">
                {activity.referenceId}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mx-2.5 sm:mx-3 px-3 sm:px-3 py-3 sm:py-3.5 md:py-4 border-t-2 border-gray-200">
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
  );

  return typeof window !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
