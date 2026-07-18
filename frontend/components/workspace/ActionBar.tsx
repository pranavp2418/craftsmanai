'use client';

import { useState, useRef, useEffect } from 'react';

interface ActionBarProps {
  onRefineDesign: () => void;
  onDownload?: () => void;
  onShareWithCustomer?: () => void;
  onShareWithManufacturer?: () => void;
  onArchive?: () => void;
  disableRefine?: boolean;
  disableDownload?: boolean;
  disableShare?: boolean;
  isDownloading?: boolean;
}

export default function ActionBar({ onRefineDesign, onDownload, onShareWithCustomer, onShareWithManufacturer, onArchive, disableRefine, disableDownload, disableShare, isDownloading }: ActionBarProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShareOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center sm:justify-between mt-3 sm:mt-0 mb-4">
      {/* LEFT: Refine Design + Download */}
      <div className="flex items-stretch sm:items-center gap-2 flex-wrap w-full sm:w-auto sm:my-3">
        <button
          onClick={() => {
            // console.info('[RefineDesign] ActionBar button clicked');
            onRefineDesign();
          }}
          disabled={disableRefine}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-semibold text-white dark:text-black transition-all duration-150 cursor-pointer whitespace-nowrap hover:opacity-90 active:scale-[0.98] w-full sm:w-auto bg-[#3B82F6] dark:bg-[#60A5FA] shadow-[0px_4px_14px_rgba(59,130,246,0.30)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center">
            <i className="ri-sparkling-line text-[13px]"></i>
          </span>
          {disableRefine ? 'Refine Disabled' : 'Refine Design'}
        </button>

        <button
          onClick={onDownload}
          disabled={disableDownload || isDownloading}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-medium text-[#3B82F6] bg-white dark:bg-surface-100 border border-[#3B82F6] dark:border-[#60A5FA] hover:bg-blue-50 dark:hover:bg-[#60A5FA]/10 transition-all duration-150 cursor-pointer whitespace-nowrap w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-[#60A5FA] dark:hover:text-[#60A5FA]"
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center">
            {isDownloading ? (
              <i className="ri-loader-4-line text-[13px] animate-spin"></i>
            ) : (
              <i className="ri-download-line text-[13px]"></i>
            )}
          </span>
          {isDownloading ? 'Downloading...' : 'Download'}
        </button>
      </div>

      {/* RIGHT: Share + Archive */}
      <div className="flex items-stretch sm:items-center gap-2 flex-wrap w-full sm:w-auto">
        <div className="relative w-full sm:w-auto" ref={shareRef}>
          <button
            onClick={() => setShareOpen((v) => !v)}
            disabled={disableShare}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-medium text-[#3B82F6] bg-white dark:bg-surface-100 border border-[#3B82F6] dark:border-[#60A5FA] hover:bg-blue-50 dark:hover:bg-[#60A5FA]/10 transition-all duration-150 cursor-pointer whitespace-nowrap w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-[#60A5FA] dark:hover:text-[#60A5FA]"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center">
              <i className="ri-share-line text-[13px]"></i>
            </span>
            <span>Share</span>
            <span className="w-3 h-3 flex items-center justify-center ml-0.5">
              <i
                className="ri-arrow-down-s-line text-[13px] transition-transform duration-150"
                style={{ transform: shareOpen ? 'rotate(180deg)' : 'none' }}
              />
            </span>
          </button>

          {shareOpen && (
            <div
              className="absolute left-0 right-auto sm:left-auto sm:right-0 top-full mt-1.5 z-50 rounded-[14px] overflow-hidden py-1.5 w-[220px] bg-white dark:bg-surface-150 shadow-[0px_8px_32px_rgba(0,0,0,0.12),_0px_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.06] dark:border-border-default"
            >
              <button
                onClick={() => { setShareOpen(false); onShareWithCustomer?.(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-[#1A1A1A] dark:text-ink hover:bg-[#F7F6F3] dark:hover:bg-surface-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span className="w-5 h-5 flex items-center justify-center rounded-[6px] bg-blue-50 dark:bg-[#60A5FA]/10">
                  <i className="ri-user-line text-[12px] text-[#3B82F6]"></i>
                </span>
                Share with Customer
              </button>
              <button
                onClick={() => { setShareOpen(false); onShareWithManufacturer?.(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-[#1A1A1A] dark:text-ink hover:bg-[#F7F6F3] dark:hover:bg-surface-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span className="w-5 h-5 flex items-center justify-center rounded-[6px] bg-purple-50 dark:bg-purple-500/10">
                  <i className="ri-building-line text-[12px] text-[#7C3AED]"></i>
                </span>
                Share with Manufacturer
              </button>
            </div>
          )}
        </div>
        {onArchive && (
          <button
            onClick={onArchive}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-[10px] text-[12px] sm:text-[13px] font-medium text-[#EF4444] transition-all duration-150 cursor-pointer whitespace-nowrap hover:bg-[#FEF2F2] dark:hover:bg-red-500/10 border border-transparent hover:border-[#FEE2E2] dark:hover:border-red-500/20 w-full sm:w-auto"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center">
              <i className="ri-archive-line text-[13px]"></i>
            </span>
            Archive
          </button>
        )}
      </div>
    </div>
  );
}