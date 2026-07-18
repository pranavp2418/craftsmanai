'use client';

import { useState } from 'react';
import { RequestData } from '@/lib/requestsData';

interface PromptSectionProps {
  request: RequestData;
  attachedImages?: string[];
}

export default function PromptSection({ request, attachedImages }: PromptSectionProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [copied, setCopied] = useState(false);

  return (
    <>
      <div className="border-t border-[#E5E7EB] dark:border-border-default my-6" />
      <div className="rounded-[20px] mb-5 flex-shrink-0 overflow-hidden bg-[#FAFAF8] dark:bg-surface-150 shadow-[0_2px_12px_rgba(0,0,0,0.04),_0_0_1px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] dark:border-border-default">
      <div
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 cursor-pointer"
      >
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-[8px] bg-[rgba(107,114,128,0.08)] dark:bg-white/10">
            <i className="ri-chat-quote-line text-[12px] sm:text-[14px] text-[#6B7280] dark:text-[#A1A8B3]" />
          </div>
          <h3
            className="text-[12px] sm:text-[13px] font-extrabold text-[#1A1A1A] dark:text-ink truncate font-satoshi"
          >
            {collapsed ? 'View Design Prompt' : 'Design Prompt'}
          </h3>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {!collapsed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(request.prompt).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="w-7 h-7 flex items-center justify-center rounded-[8px] hover:bg-black/[0.06] transition-colors cursor-pointer"
              title="Copy prompt"
            >
              <i className={`${copied ? 'ri-check-line text-[#16A34A]' : 'ri-file-copy-line text-[#9CA3AF]'} text-[14px]`} />
            </button>
          )}
          <span className="w-5 h-5 flex items-center justify-center">
            <i
              className={`${collapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'} text-[16px] text-[#9CA3AF] transition-transform duration-200`}
            />
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 sm:px-6 pb-5">
          <div className="min-w-0">
            <div className="rounded-[14px] p-3 sm:p-4 mb-3 bg-[#F7F6F3] dark:bg-surface-100 border border-[rgba(0,0,0,0.04)] dark:border-border-default">
              <p
                className="text-[12px] sm:text-[13px] text-[#374151] dark:text-ink leading-relaxed font-inter"
              >
                {request.prompt}
              </p>
            </div>

            {attachedImages && attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mb-3.5">
                {attachedImages.map((imageUrl, index) => (
                  <div
                    key={index}
                    onClick={() => window.open(imageUrl, '_blank')}
                    className="inline-flex items-center gap-2.5 px-3 py-2 rounded-[16px] bg-[#F3F4F6] dark:bg-surface-200 hover:bg-[#E5E7EB] dark:hover:bg-surface-300 border border-black/[0.03] transition-all cursor-pointer select-none group"
                    title="Click to view full image"
                  >
                    <div className="w-10 h-10 rounded-[10px] overflow-hidden border border-black/[0.04] bg-white flex-shrink-0">
                      <img
                        src={imageUrl}
                        alt={`Attached ${index + 1}`}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                    <span className="text-[12px] font-semibold text-[#374151] dark:text-ink-300 font-satoshi pr-1">
                      Attached image
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-[11px] font-medium px-2.5 py-1 rounded-md bg-[rgba(59,130,246,0.08)] text-[#3B82F6]">
                {request.type}
              </span>
              <span className="text-[10px] sm:text-[11px] text-[#C4C4C4] dark:text-[#A1A8B3]">
                {request.drafts.find((d) => d.isCurrent)?.timestamp || request.date}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}