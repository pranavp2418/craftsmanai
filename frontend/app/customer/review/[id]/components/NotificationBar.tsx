'use client';

import React, { useState } from 'react';
import { Info, X } from 'lucide-react';

interface NotificationBarProps {
  brandPrimaryColor?: string;
}

export default function NotificationBar({ brandPrimaryColor = '#4169E1' }: NotificationBarProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 text-white py-3 sm:py-4 px-3 sm:px-4 md:px-6 shadow-lg z-50" style={{ backgroundColor: brandPrimaryColor }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <Info className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <p className="text-xs sm:text-sm md:text-base font-medium truncate sm:whitespace-normal">
            You can only view and comment on this file.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white rounded-md sm:rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-100 transition-colors whitespace-nowrap cursor-pointer" style={{ color: brandPrimaryColor }}>
            Ask an edit
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 rounded transition-colors cursor-pointer hover:bg-white/15"
            aria-label="Close notification"
            style={{ color: 'white' }}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
