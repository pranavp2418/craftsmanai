'use client';

import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';

interface FilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div className="relative self-stretch min-w-0" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-full flex items-center justify-between gap-1.5 px-3 py-2 md:py-3 bg-[#f1f1f1] rounded-lg md:rounded-2xl text-xs sm:text-sm font-medium text-[#6D6D6D] hover:bg-gray-100 transition-colors cursor-pointer tracking-wide"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 w-full min-w-0 bg-white border border-gray-200 rounded-lg shadow-lg z-[70] overflow-y-auto max-h-60">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 text-sm transition-colors cursor-pointer truncate ${
                value === option.value
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;
