import React from 'react';

export default function RetailerLoading() {
  return (
    <div className="min-h-screen bg-surface-page dark:bg-surface-page text-ink dark:text-ink">
      {/* 1. Header (TopBar Skeleton) */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 lg:px-8 pt-4 lg:pt-5 pb-3 border-b border-default dark:border-border-default bg-surface-page dark:bg-surface-page">
        <div className="flex items-center gap-2">
          {/* Mobile hamburger menu placeholder */}
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-surface-150 animate-pulse lg:hidden" />
          {/* Title ("Dashboard") */}
          <div className="h-5 w-24 bg-gray-200 dark:bg-surface-150 rounded-[6px] animate-pulse" />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications button skeleton */}
          <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-surface-150 animate-pulse" />
          {/* Profile avatar skeleton */}
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-surface-150 animate-pulse" />
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="px-4 sm:px-6 lg:px-8 pb-6 lg:pb-8 pt-3">
        {/* A. PromptBox / Jewelry selector skeleton */}
        <div>
          {/* Category labels horizontal list */}
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-4 pt-1 select-none scrollbar-none">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 px-4 py-2.5 rounded-full bg-white dark:bg-surface-100 border border-[#ECEEF2] dark:border-border-default flex items-center gap-2 min-w-[100px] justify-center animate-pulse"
              >
                <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-surface-200" />
                <div className="h-3 w-12 bg-gray-200 dark:bg-surface-200 rounded" />
              </div>
            ))}
          </div>

          {/* Prompt Section title */}
          <div className="h-3.5 w-48 bg-gray-200 dark:bg-surface-150 rounded animate-pulse mb-3 mt-1" />

          {/* Main prompt input box container skeleton */}
          <div className="w-full rounded-2xl border border-[#ECEEF2] dark:border-border-default bg-white dark:bg-surface-100 shadow-[0px_4px_20px_rgba(0,0,0,0.02)] mb-4 overflow-hidden animate-pulse">
            {/* Header: Design #... */}
            <div className="flex items-center gap-2 px-6 py-4 border-b border-[#ECEEF2] dark:border-border-default bg-gray-50/20 dark:bg-surface-150">
              <div className="h-3 w-16 bg-gray-200 dark:bg-surface-200 rounded" />
              <div className="h-3 w-12 bg-gray-200 dark:bg-surface-200 rounded" />
            </div>

            {/* Textarea placeholder area */}
            <div className="px-6 pt-5 pb-3 space-y-3">
              <div className="h-4 bg-gray-200 dark:bg-surface-150 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-surface-150 rounded w-1/2" />
              <div className="h-3.5 bg-gray-200 dark:bg-surface-150 rounded w-1/4 pt-2" />
            </div>

            {/* Footer with actions */}
            <div className="px-6 pb-5 pt-4 border-t border-hairline bg-gray-50/20 dark:bg-surface-150 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Attachment actions */}
              <div className="flex items-center gap-2">
                <div className="h-8 w-20 rounded-full bg-gray-200 dark:bg-surface-200" />
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-surface-200" />
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-surface-200" />
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-surface-200" />
              </div>
              {/* Generate button */}
              <div className="h-10 w-36 rounded-full bg-gray-200 dark:bg-surface-200 self-end sm:self-auto" />
            </div>
          </div>
        </div>

        {/* B. RequestHeader skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 mt-6 animate-pulse">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* DESIGN CATALOG title */}
            <div className="h-3.5 w-32 bg-gray-200 dark:bg-surface-150 rounded" />
            {/* Toggle button */}
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-surface-150" />
          </div>
          {/* Search bar */}
          <div className="h-10 w-full sm:w-[260px] md:w-[320px] rounded-full bg-gray-200 dark:bg-surface-150" />
        </div>

        {/* C. DesignGrid skeleton (8 cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={`design-skeleton-${idx}`}
              className="relative overflow-hidden rounded-[14px] aspect-[3/3.3] bg-white dark:bg-surface-100 border border-[#E5E7EB] dark:border-white/[0.08]"
            >
              <div className="absolute inset-0 animate-pulse">
                {/* Shimmer background */}
                <div className="absolute inset-0 bg-[#F3F4F6] dark:bg-surface-150" />
                {/* Top right status badge skeleton */}
                <div className="absolute top-2 right-2 h-4 w-16 rounded-full bg-[#E5E7EB] dark:bg-surface-200" />
                {/* Bottom title & metadata skeleton */}
                <div className="absolute bottom-0 left-0 right-0 px-2.5 sm:px-3 pb-2.5 sm:pb-3">
                  <div className="h-3 w-24 rounded bg-[#E5E7EB] dark:bg-surface-200" />
                  <div className="mt-2 h-2.5 w-20 rounded bg-[#E5E7EB] dark:bg-surface-200" />
                  <div className="mt-2 h-2 w-12 rounded bg-[#E5E7EB] dark:bg-surface-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
