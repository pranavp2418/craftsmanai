'use client';

import { useState } from 'react';

interface RequestHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export default function RequestHeader({ collapsed, onToggle, search, onSearchChange }: RequestHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3 text-ink dark:text-ink mt-10">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <h2 className="text-[14px] sm:text-sm font-bold text-[#6B7280] dark:text-[#F8F9FB] uppercase tracking-wider mb-3 font-inter leading-none mt-3">
          DESIGN CATALOG
        </h2>
        <button
          onClick={onToggle}
          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full border border-[#E5E7EB] dark:border-border-default bg-white dark:bg-surface-100 hover:border-[#D1D5DB] dark:hover:border-border-default transition-all duration-200 cursor-pointer flex-shrink-0"
          title={collapsed ? 'Expand catalog' : 'Collapse catalog'}
        >
          <i
            className={`${collapsed ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line'} text-[14px] sm:text-[16px] text-[#6B7280] dark:text-[#A1A8B3]`}
          />
        </button>
      </div>

      <div className="relative w-full sm:w-auto sm:min-w-[260px] md:min-w-[320px]">
        <span className="w-4 h-4 flex items-center justify-center ri-search-line text-[#BDBDBD] absolute left-3 top-1/2 -translate-y-1/2 text-[14px] sm:text-[15px] pointer-events-none"></span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value.replace(/^\s+/, ''))}
          onBlur={(e) => onSearchChange(e.target.value.trim())}
          placeholder="Search by Name & Design Code ..."
          className="pl-9 pr-4 py-2 rounded-full bg-white dark:bg-surface-100 text-[12px] sm:text-[13px] text-[#1A1A1A] dark:text-ink placeholder:text-[#BDBDBD] dark:placeholder:text-[#A1A8B3] outline-none w-full sm:w-full shadow-[0_1px_6px_rgba(0,0,0,0.05)] border border-transparent dark:border-border-default font-inter max-sm:placeholder:text-sm"
        />
      </div>
    </div>
  );
}