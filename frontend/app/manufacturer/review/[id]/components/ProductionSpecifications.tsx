import React from 'react';

interface StoneDetails {
  center_stone?: Record<string, unknown>;
  accent_stones?: Record<string, unknown>;
  accent_stone?: Record<string, unknown>;
}

interface ProductionSpecificationsProps {
  materialDetails?: Record<string, unknown>;
  stoneDetails?: StoneDetails;
  dimensions?: Record<string, unknown>;
  specificationDetails?: Record<string, unknown>;
  specialInstructions?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  loading?: boolean;
  brandPrimaryColor?: string;
}

const formatLabel = (key: string): string =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

const HIDDEN_MATERIAL_KEYS = new Set(['hallmark_required', 'rhodium_finish']);

const KVRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-start gap-4 py-1.5 sm:py-2 border-b border-gray-100 min-w-0">
    <span className="text-xs sm:text-sm text-gray-600 shrink-0">{label}</span>
    <span className="text-xs sm:text-sm text-gray-900 text-right font-medium break-all break-words min-w-0">{value}</span>
  </div>
);

const ShimmerRows = ({ count = 4 }: { count?: number }) => (
  <div className="space-y-2 sm:space-y-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex justify-between py-1.5 sm:py-2 border-b border-gray-100 last:border-0">
        <div className="h-3.5 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-3.5 w-28 bg-gray-200 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

export default function ProductionSpecifications({
  materialDetails,
  stoneDetails,
  dimensions,
  specificationDetails,
  specialInstructions,
  fileUrl,
  fileName,
  loading = false,
  brandPrimaryColor = '#3B82F6',
}: ProductionSpecificationsProps) {
  const materialItems = Object.entries(materialDetails ?? {})
    .filter(([key]) => !HIDDEN_MATERIAL_KEYS.has(key))
    .map(([k, v]) => ({
      label: formatLabel(k),
      value: formatValue(v),
    }));

  
  const centerStoneItems = Object.entries(stoneDetails?.center_stone ?? {}).map(([k, v]) => ({
    label: formatLabel(k),
    value: formatValue(v),
  }));

  const accentStonesItems = Object.entries(stoneDetails?.accent_stones ?? {}).map(([k, v]) => ({
    label: formatLabel(k),
    value: formatValue(v),
  }));

  const accentStoneItems = Object.entries(stoneDetails?.accent_stone ?? {}).map(([k, v]) => ({
    label: formatLabel(k),
    value: formatValue(v),
  }));

  const dimensionItems = Object.entries(dimensions ?? {}).map(([k, v]) => ({
    label: formatLabel(k),
    value: formatValue(v),
  }));

  const specItems = Object.entries(specificationDetails ?? {}).map(([k, v]) => ({
    label: formatLabel(k),
    value: formatValue(v),
  }));

  const hasFile = Boolean(fileUrl);
  const resolvedFileName = fileName?.trim() || 'View Image';

  return (
    <>
      {/* Material Detail Card - Left */}
      <div className="lg:col-span-2 min-w-0 bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)]">
        <h3 className="text-base sm:text-lg md:text-xl font-medium text-gray-900 mb-4 sm:mb-5 md:mb-6">
          Production Specifications
        </h3>

        {loading ? (
          <>
            <div className="h-4 w-28 bg-gray-200 rounded animate-pulse mb-3 sm:mb-4" />
            <ShimmerRows count={5} />
          </>
        ) : (
          <>
            {materialItems.length > 0 && (
              <>
                <p className="text-sm sm:text-base font-medium text-gray-900 mb-3 sm:mb-4">
                  Material Detail
                </p>
                <div className="space-y-2 sm:space-y-2.5 md:space-y-3 mb-5">
                  {materialItems.map((item, index) => (
                    <KVRow key={index} label={item.label} value={item.value} />
                  ))}
                </div>
              </>
            )}

            {centerStoneItems.length > 0 && (
              <>
                <p className="text-sm sm:text-base font-medium text-gray-900 mb-3 sm:mb-4">
                  Stone Detail
                </p>
                <div className="space-y-2 sm:space-y-2.5 md:space-y-3 mb-5">
                  {centerStoneItems.map((item, index) => (
                    <KVRow key={index} label={item.label} value={item.value} />
                  ))}
                </div>
              </>
            )}

            {(accentStonesItems.length > 0 || accentStoneItems.length > 0) && (
              <>
                <p className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">
                  Accent Stones
                </p>
                <div className="space-y-2 sm:space-y-2.5 md:space-y-3">
                  {[...accentStonesItems, ...accentStoneItems].map((item, index) => (
                    <KVRow key={index} label={item.label} value={item.value} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className='lg:col-span-2 min-w-0 gap-5 flex flex-col'>
        {/* Dimensions & Specs Card - Right */}
        <div className="bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] flex flex-col min-w-0">
          <h3 className="text-base sm:text-lg md:text-xl font-medium text-gray-900 mb-4 sm:mb-5 md:mb-6">
            Production Specifications
          </h3>

          {loading ? (
            <>
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-3 sm:mb-4" />
              <ShimmerRows count={4} />
            </>
          ) : (
            <div className="mb-6 sm:mb-0">
              {dimensionItems.length > 0 && (
                <>
                  <p className="text-sm sm:text-base font-medium text-gray-900 mb-3 sm:mb-4">
                    Dimensions
                  </p>
                  <div className="space-y-2 sm:space-y-2.5 md:space-y-3 mb-5">
                    {dimensionItems.map((item, index) => (
                      <KVRow key={index} label={item.label} value={item.value} />
                    ))}
                  </div>
                </>
              )}

              {/* {specItems.length > 0 && (
                <>
                  <p className="text-sm sm:text-base font-medium text-gray-900 mb-3 sm:mb-4">
                    Specifications
                  </p>
                  <div className="space-y-2 sm:space-y-2.5 md:space-y-3 mb-5">
                    {specItems.map((item, index) => (
                      <KVRow key={index} label={item.label} value={item.value} />
                    ))}
                  </div>
                </>
              )} */}

              {specialInstructions && (
                <div className="mt-2">
                  <p className="text-xs sm:text-sm text-[#373737] mb-2 sm:mb-3">
                    Special Instructions
                  </p>
                  <p className="text-xs sm:text-sm font-medium text-[#373737] leading-relaxed break-all break-words">
                    {specialInstructions}
                  </p>
                </div>
              )}

              {hasFile && (
              <button
                  type="button"
                  onClick={() => window.open(fileUrl!, '_blank', 'noopener,noreferrer')}
                  className="flex items-center gap-5 text-white py-3 rounded-xl mt-5 w-fit px-5 cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: brandPrimaryColor }}
                >
                  <div>
                    <svg width="26" height="34" viewBox="0 0 26 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3.25 33.3333C2.35625 33.3333 1.59115 33.0069 0.954688 32.3542C0.318229 31.7014 0 30.9167 0 30V3.33333C0 2.41667 0.318229 1.63194 0.954688 0.979167C1.59115 0.326389 2.35625 0 3.25 0H14.9094C15.3427 0 15.7557 0.0833333 16.1484 0.25C16.5411 0.416667 16.8865 0.652778 17.1844 0.958333L25.0656 9.04167C25.3635 9.34722 25.5938 9.70139 25.7563 10.1042C25.9188 10.5069 26 10.9306 26 11.375V30C26 30.9167 25.6818 31.7014 25.0453 32.3542C24.4089 33.0069 23.6437 33.3333 22.75 33.3333H3.25ZM14.625 10C14.625 10.4722 14.7807 10.8681 15.0922 11.1875C15.4036 11.5069 15.7896 11.6667 16.25 11.6667H22.75L14.625 3.33333V10Z" fill="currentColor" />
                    </svg>
                  </div>
                  <div>
                    {/* <h4 className="text-base font-medium text-[#515151]">{resolvedFileName}</h4> */}
                    <h4 className="text-base font-medium text-[#515151]">Attached Image</h4>
                    <p className="text-sm text-[#515151]">Tap to open image</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Review Message - Bottom Section */}
        <div className="mt-auto bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] border-t border-gray-100">
          <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">
            Review specifications carefully before submitting your quote.
          </h4>
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            Ensure all material and stone requirements can be met.
          </p>
        </div>
      </div>
    </>
  );
}

