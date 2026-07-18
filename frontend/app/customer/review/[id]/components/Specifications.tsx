import React from 'react';
import { FileText } from 'lucide-react';

interface SpecificationsProps {
  specifications: Record<string, string>;
  specialInstructions?: string | null;
  isDesignReview?: boolean;
}

export default function Specifications({ specifications, specialInstructions, isDesignReview }: SpecificationsProps) {
  const cleanSpecialInstructions = specialInstructions ? specialInstructions.split('--- METADATA ---')[0].trim() : null;

  const specItems = Object.entries(specifications).map(([key, value]) => ({
    label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: value ?? '-',
  }));

  return (
    <div className="h-full w-full min-w-0 bg-white rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 shadow-sm">
      <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">Specifications</h3>
      
      <div className='flex flex-col items-between justify-between h-full pb-10 w-full min-w-0'>
        {/* Specifications Grid */}
        <div className="space-y-2 sm:space-y-2.5 md:space-y-3 mb-4 sm:mb-5 md:mb-6">
          {specItems.map((item, index) => {
            const isUserPrompt = item.label.toLowerCase() === 'user prompt';
            if (isUserPrompt) {
              return (
                <div
                  key={index}
                  className="flex flex-col gap-1 py-2.5 border-b border-gray-100 last:border-0"
                >
                  <span className="text-xs sm:text-sm font-medium text-gray-500">{item.label}</span>
                  <span className="text-xs sm:text-sm text-gray-900 text-left whitespace-pre-wrap break-words break-all max-h-[160px] overflow-y-auto pr-1 leading-relaxed font-normal">
                    {item.value}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={index}
                className="flex justify-between items-center py-1.5 sm:py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-xs sm:text-sm font-medium text-gray-600 shrink-0">{item.label}</span>
                <span className="text-xs sm:text-sm text-gray-900 text-right truncate min-w-0 pl-4">{item.value}</span>
              </div>
            );
          })}
        </div>



        {/* Special Instructions */}
        {cleanSpecialInstructions && !isDesignReview && (
          <div className="mb-3 sm:mb-4">
            <h4 className="text-xs sm:text-base  text-[#6B7280] mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
              {/* <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" /> */}
              Special Instructions
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-medium rounded-lg max-h-[160px] overflow-y-auto pr-1 break-words break-all whitespace-pre-wrap">
              {cleanSpecialInstructions}
            </p>
          </div>
        )}

        {/* Additional Notes */}
        {isDesignReview && cleanSpecialInstructions && (
          <div className="bg-[#F9FAFB] rounded-xl p-3 sm:p-4">
            <h4 className="text-xs sm:text-sm font-medium text-gray-800 mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
              Additional Notes
            </h4>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-h-[160px] overflow-y-auto pr-1 break-words break-all whitespace-pre-wrap">
              {cleanSpecialInstructions}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
