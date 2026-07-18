'use client';

import { useState } from 'react';

const categories: readonly string[] = ['Ring', 'Pendant', 'Earring', 'Bracelet', 'Necklace', 'Watch', 'Grill', '+ More'];

interface CategoryFilterProps {
  value?: string;
  onChange?: (cat: string) => void;
}

export default function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const [internal, setInternal] = useState('Ring');
  const active = value ?? internal;

  const handleClick = (cat: string) => {
    if (onChange) onChange(cat);
    else setInternal(cat);
  };

  return (
    <div className="flex items-center gap-2 flex-nowrap overflow-x-auto mb-4 scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => handleClick(cat)}
          className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-150 whitespace-nowrap cursor-pointer flex-shrink-0 ${
            active === cat
              ? 'bg-[#3B82F6] text-white'
              : 'bg-[#EEF1F5] text-[#6B7280] hover:bg-[#E2E6EC] hover:text-[#374151]'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
