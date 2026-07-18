import React from 'react';

interface ProductionHeaderProps {
  title: string;
  requestSku: string;
  companyName?: string;
  lastUpdated: string;
  isNew?: boolean;
  loading?: boolean;
}

export default function ProductionHeader({
  title,
  requestSku,
  companyName,
  lastUpdated,
  isNew = false,
  loading = false,
}: ProductionHeaderProps) {
  if (loading) {
    return (
      <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="flex-1 space-y-2 sm:space-y-2.5">
            <div className="h-7 sm:h-8 md:h-9 w-3/4 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-2/5 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-8 w-14 bg-gray-200 rounded-full animate-pulse shrink-0" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl md:rounded-2xl shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl flex justify-between font-semibold text-gray-900 mb-2 sm:mb-3">
            {title} {isNew && (
          <div>
            <span className="inline-flex md:hidden items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-amber-100 text-amber-700 text-xs sm:text-sm font-medium whitespace-nowrap">
              New
            </span>
          </div>
        )}
          </h2>
          <div className="space-y-1 sm:space-y-1.5">
            <p className="text-sm md:text-base text-gray-600">
              {requestSku}
            </p>
            {companyName && (
              <p className="text-sm sm:text-base text-gray-600">
                {companyName}
              </p>
            )}
            <p className="text-sm sm:text-base text-gray-600">
              <span className="font-semibold">Last Updated:</span> {lastUpdated}
            </p>
          </div>
        </div>
        {isNew && (
          <div>
            <span className="hidden md:inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-amber-100 text-amber-700 text-xs sm:text-sm font-medium whitespace-nowrap">
              New
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
