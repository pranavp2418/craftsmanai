import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export type FilterType = 'all' | 'active' | 'inactive';
export type SubFilterType = 'recently_added' | 'alphabetical';

interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  activeSubFilter: SubFilterType;
  onSubFilterChange: (subFilter: SubFilterType) => void;
}

const FilterTabs: React.FC<FilterTabsProps> = ({ activeFilter, onFilterChange, activeSubFilter, onSubFilterChange }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showDropdown]);
  
  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Disabled', value: 'inactive' },
  ];

  const sortOptions: { label: string; value: SubFilterType }[] = [
    { label: 'Recently Added', value: 'recently_added' },
    { label: 'Alphabetically', value: 'alphabetical' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
      {/* Tab Pills Container */}
      <div className="inline-flex items-center bg-[#F1F1F1] rounded-full p-1">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={`flex-1 sm:flex-none px-4 sm:px-5 md:px-7 py-2 sm:py-2.5 rounded-full font-medium transition-all duration-200 text-xs sm:text-sm whitespace-nowrap ${
              activeFilter === filter.value
                ? 'bg-[#2C62B9] text-white shadow-sm'
                : 'bg-transparent text-[#373737] hover:text-gray-900'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Sort Dropdown */}
      <div className="relative w-full sm:w-auto" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full h-full inline-flex items-center justify-between gap-1.5 px-3 py-1.5 md:py-3 bg-[#F1F1F1] text-[#6D6D6D] rounded-lg md:rounded-2xl font-medium transition-colors text-sm hover:bg-gray-100 cursor-pointer tracking-wide"
        >
          <span className="truncate">{sortOptions.find(opt => opt.value === activeSubFilter)?.label}</span>
          <ChevronDown size={16} className={`transition-transform duration-200 shrink-0 ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 mt-1 w-44 sm:w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSubFilterChange(option.value);
                  setShowDropdown(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  activeSubFilter === option.value
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-[#1F2937] hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterTabs;
