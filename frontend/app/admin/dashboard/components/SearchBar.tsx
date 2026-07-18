import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Search' 
}) => {
  return (
    <div className="relative flex-1 max-w-full md:max-w-md">
      <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 bg-white border border-gray-200 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs sm:text-sm md:text-base text-gray-900 placeholder:text-gray-400"
      />
    </div>
  );
};

export default SearchBar;
