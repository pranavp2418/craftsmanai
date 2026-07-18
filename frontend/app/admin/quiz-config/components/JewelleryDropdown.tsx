'use client';

import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/src/utils/hooks/clickOutsideClose';

interface JewelleryDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  label?: string;
  required?: boolean;
}

const JewelleryDropdown: React.FC<JewelleryDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select',
  label,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div className="flex-1 relative" ref={dropdownRef}>
      {label && (
        <label className="block text-sm font-normal text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-[#F9F9F9] border border-gray-200 rounded-lg text-sm font-normal text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <span className={`${value ? 'text-gray-900' : 'text-gray-400'}`}>{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform text-gray-400 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
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

export default JewelleryDropdown;
