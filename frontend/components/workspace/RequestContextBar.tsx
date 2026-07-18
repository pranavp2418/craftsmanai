'use client';

import { useState } from 'react';
import { RequestData, statusStyles, statusLabels } from '@/lib/requestsData';
import MarkCompleteModal from './MarkCompleteModal';

interface RequestContextBarProps {
  request: RequestData;
  onStatusChange?: () => void;
  isMarkingComplete?: boolean;
}

export default function RequestContextBar({ request, onStatusChange, isMarkingComplete }: RequestContextBarProps) {
  const s = statusStyles[request.status] || { bg: 'bg-tint-gray', text: 'text-ink-500' };
  const [showMarkComplete, setShowMarkComplete] = useState(false);

  const normStatus = (request.status || '').trim().toUpperCase();
  const isCompleted = normStatus === 'COMPLETED';
  const canMarkComplete = !isCompleted && normStatus !== 'DRAFT' && normStatus !== 'GENERATING' && normStatus !== 'PENDING' && normStatus !== 'PROCESSING';

  const handleConfirmComplete = () => {
    onStatusChange?.();
  };

  return (
    <>
      {showMarkComplete && (
        <MarkCompleteModal
          onClose={() => setShowMarkComplete(false)}
          onConfirm={handleConfirmComplete}
          isLoading={isMarkingComplete}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 pb-4 border-b border-[#F0EEEB] dark:border-white/[0.08]">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-[18px] sm:text-[22px] font-semibold text-[#1A1A1A] dark:text-[#F0F2F4] leading-tight font-satoshi">
                {request.designCode || request.id}
              </span>
              <span
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11.5px] font-semibold whitespace-nowrap ${s.bg} ${s.text}`}
              >
                {statusLabels[request.status] || request.status}
              </span>
            </div>
            <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] sm:text-[12.5px] text-[#9CA3AF] dark:text-[#A1A8B3] flex-wrap">
              <span className="flex items-center gap-1">
                <i className="ri-vip-diamond-line text-[12px] sm:text-[13px]"></i>
                {request.type}
              </span>
              <span className="w-1 h-1 rounded-full bg-[#D1D5DB] dark:bg-white/20"></span>
              <span className="flex items-center gap-1">
                <i className="ri-calendar-line text-[12px] sm:text-[13px]"></i>
                {request.date}
              </span>
            </div>
          </div>
        </div>

        {canMarkComplete && (
          <button
            onClick={() => setShowMarkComplete(true)}
            disabled={isMarkingComplete}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-[10px] text-[12px] sm:text-[13px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap hover:opacity-90 active:scale-[0.98] w-full sm:w-auto text-[#16A34A] dark:text-black border-[1.5px]  dark:!bg-[#16A34A] border-[#16A34A]   dark:bg-green-950/20 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-[13px]  text-[#16A34A] dark:text-black"></i>
            </span>
            {isMarkingComplete ? 'Marking...' : 'Mark as Complete'}
          </button>
        )}

        {isCompleted && (
          <button
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-[10px] text-[12px] sm:text-[13px] font-semibold text-white transition-all duration-150 cursor-pointer whitespace-nowrap w-full sm:w-auto bg-[#16A34A]"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-[13px]"></i>
            </span>
            Completed
          </button>
        )}
      </div>
    </>
  );
}